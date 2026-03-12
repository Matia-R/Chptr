/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- tRPC procedure chain types are correct but not inferred through middleware */
import { createTRPCRouter, protectedProcedure, rateLimitMiddleware } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash } from "crypto";
import { generateText, streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions";
import { MAX_PROMPT_LENGTH } from "~/app/ai/prompt/constants";
import {
  getDocumentReviewCriteria,
  getDocumentReviewFeedbackHashes,
  tryClaimDocumentReviewRun,
  upsertDocumentReviewCriteria,
  upsertDocumentReviewFeedback,
} from "~/server/db";

const DEFAULT_MODEL = 'gemini-flash-latest';

const quickGenerateInputSchema = z.object({
    action: z.nativeEnum(AtAction),
    content: z.string()
});

const generateForPromptInputSchema = z
    .object({
        prompt: z.string().max(MAX_PROMPT_LENGTH, { message: "Prompt is too long" }),
        documentContext: z.string().optional(),
        previousResponse: z.string().optional(),
        followUp: z.string().max(MAX_PROMPT_LENGTH, { message: "Prompt is too long" }).optional(),
    })
    .refine(
        (data) => {
            const hasFollowUp = data.followUp != null && data.followUp !== "";
            const hasPrevious = data.previousResponse != null && data.previousResponse !== "";
            return hasFollowUp === hasPrevious;
        },
        { message: "previousResponse and followUp must both be provided for a follow-up" }
    );

const summarizeBlockMarkdownInputSchema = z.object({
    markdown: z.string().max(16_000, { message: "Content is too long" }),
});

const reviewBlockInputSchema = z.object({
    documentId: z.string().uuid(),
    contentHash: z.string().min(1).max(128),
    markdown: z.string().max(16_000, { message: "Content is too long" }),
});

const reportBlocksAndMaybeReviewInputSchema = z.object({
    documentId: z.string().uuid(),
    blocks: z
        .array(
            z.object({
                contentHash: z.string().min(1).max(128),
                markdown: z.string().max(16_000),
                index: z.number().int().min(0),
            })
        )
        .min(0)
        .max(200),
});

type QuickGenerateInput = z.infer<typeof quickGenerateInputSchema>;
type GenerateForPromptInput = z.infer<typeof generateForPromptInputSchema>;
type SummarizeBlockMarkdownInput = z.infer<typeof summarizeBlockMarkdownInputSchema>;
type ReviewBlockInput = z.infer<typeof reviewBlockInputSchema>;
type ReportBlocksAndMaybeReviewInput = z.infer<
    typeof reportBlocksAndMaybeReviewInputSchema
>;

// Rate limit: 30 requests per minute per user. Chain is correctly typed; eslint no-unsafe-* flags tRPC middleware chain.
const aiRateLimit = rateLimitMiddleware(30, 60_000);

export const aiPromptRouter = createTRPCRouter({
    quickGenerateAction: protectedProcedure
        .use(aiRateLimit)
        .input(quickGenerateInputSchema)
        .mutation(async function* ({ input }: { input: QuickGenerateInput }) {
            const config = atActionsConfig[input.action];
            const { textStream } = streamText({
                model: google(DEFAULT_MODEL),
                system: buildSystemPrompt(undefined),
                prompt: `${config.prompt} ${input.content}`,
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: "word"
                }),
            });

            for await (const text of textStream) {
                yield text;
            }
        }),

    generateForPrompt: protectedProcedure
        .use(aiRateLimit)
        .input(generateForPromptInputSchema)
        .mutation(async function* ({ input }: { input: GenerateForPromptInput }) {
            const isFollowUp =
                input.followUp != null &&
                input.followUp !== "" &&
                input.previousResponse != null &&
                input.previousResponse !== "";

            const systemPromptWithContext = buildSystemPrompt(input.documentContext);

            const { textStream } = streamText({
                model: google(DEFAULT_MODEL),
                system: systemPromptWithContext,
                ...(isFollowUp
                    ? {
                          messages: [
                              { role: "user" as const, content: input.prompt },
                              { role: "assistant" as const, content: input.previousResponse! },
                              { role: "user" as const, content: input.followUp! },
                          ],
                      }
                    : { prompt: input.prompt }),
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: "word",
                }),
            });

            for await (const text of textStream) {
                yield text;
            }
        }),

    summarizeBlockMarkdown: protectedProcedure
        .use(aiRateLimit)
        .input(summarizeBlockMarkdownInputSchema)
        .mutation(async ({ input }: { input: SummarizeBlockMarkdownInput }) => {
            const { text } = await generateText({
                model: google(DEFAULT_MODEL),
                system: "Summarize the following markdown content in 1–2 concise sentences. Preserve the main idea only. No preamble.",
                prompt: input.markdown.trim() || "(empty block)",
            });
            return { summary: text };
        }),

    /** Run AI review for a block, write suggestions to Supabase; all clients get them via Realtime. */
    reviewBlock: protectedProcedure
        .use(aiRateLimit)
        .input(reviewBlockInputSchema)
        .mutation(async ({ input }: { input: ReviewBlockInput }) => {
            const trimmed = input.markdown.trim();
            const serverHash = createHash("sha256").update(trimmed).digest("hex");
            if (serverHash !== input.contentHash) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Content hash mismatch" });
            }
            const { text } = await generateText({
                model: google(DEFAULT_MODEL),
                system: `You are a writing coach. Given a short block of text, suggest 1–3 concrete, brief improvements (e.g. clarity, tone, grammar). Reply with a JSON array of strings only, e.g. ["Suggestion one.", "Suggestion two."]. No other text.`,
                prompt: trimmed || "(empty block)",
            });
            let suggestions: string[] = [];
            try {
                const parsed = JSON.parse(text) as unknown;
                suggestions = Array.isArray(parsed)
                    ? parsed.filter((s): s is string => typeof s === "string")
                    : [];
            } catch {
                suggestions = text.split(/\n/).filter((s) => s.trim().length > 0).slice(0, 3);
            }
            await upsertDocumentReviewFeedback(input.documentId, input.contentHash, suggestions);
            return { success: true, suggestions };
        }),

    /**
     * Passive review: client reports current blocks; server batches and runs review if needed.
     * Throttled (one run per document per cooldown) to avoid duplicate LLM calls across tabs.
     */
    reportBlocksAndMaybeReview: protectedProcedure
        .use(aiRateLimit)
        .input(reportBlocksAndMaybeReviewInputSchema)
        .mutation(async ({ input }: { input: ReportBlocksAndMaybeReviewInput }) => {
            if (input.blocks.length === 0) {
                return { didRun: false, reviewedCount: 0 };
            }

            const existingHashes = await getDocumentReviewFeedbackHashes(input.documentId);
            const needReview = input.blocks.filter(
                (b) => !existingHashes.has(b.contentHash) && (b.markdown?.trim() ?? "") !== ""
            );
            if (needReview.length === 0) {
                return { didRun: false, reviewedCount: 0 };
            }

            const claimed = await tryClaimDocumentReviewRun(input.documentId, 2);
            if (!claimed) {
                return { didRun: false, reviewedCount: 0 };
            }

            const criteria = await getDocumentReviewCriteria(input.documentId);

            const sorted = [...needReview].sort((a, b) => a.index - b.index);
            const batch = sorted.slice(0, 10);
            const contextParts: string[] = [];
            for (const b of input.blocks.sort((a, b) => a.index - b.index)) {
                contextParts.push(`--- Block ${b.index} ---\n${(b.markdown ?? "").trim() || "(empty)"}`);
            }
            const documentContext = contextParts.join("\n\n");
            const reviewBlocksText = batch
                .map(
                    (b) =>
                        `[REVIEW_ID: ${b.contentHash}]\n${(b.markdown ?? "").trim() || "(empty)"}`
                )
                .join("\n\n");

            const criteriaSection =
                criteria.trim() === ""
                    ? "No explicit reviewing criteria were provided. Default to light-touch review focused on clear issues only."
                    : `Reviewing criteria from the user (higher priority than defaults):\n${criteria.trim()}`;

            const prompt = `Document context (all blocks in order):\n\n${documentContext}\n\n${criteriaSection}\n\n--- Blocks to review (each prefixed with REVIEW_ID) ---\n\n${reviewBlocksText}\n\nFor each REVIEW_ID, decide whether any changes are clearly justified.\nOnly suggest changes when they clearly improve clarity, correctness, or better align with the reviewing criteria. It is perfectly acceptable to return an empty array for blocks that are already good enough.\n\nReply with a JSON object only. Keys are the REVIEW_ID (content hash) values above. Each value is an array of 0–3 suggestion strings. Example: {"abc123": ["Improve clarity.", "Add a transition."], "def456": []}. No other text.`;

            const { text } = await generateText({
                model: google(DEFAULT_MODEL),
                system: "You are a thoughtful but lenient writing coach. Your goal is to improve the document without being overbearing. Only suggest changes when they clearly improve clarity, correctness, or alignment with the reviewing criteria. It is often best to make no suggestions for blocks that are already solid. Use the document context and criteria for consistency. Reply only with the JSON object.",
                prompt,
            });

            let parsed: Record<string, unknown> = {};
            try {
                const cleaned = text.replace(/```json?\s*/i, "").replace(/```\s*$/, "").trim();
                parsed = JSON.parse(cleaned) as Record<string, unknown>;
            } catch {
                return { didRun: true, reviewedCount: 0 };
            }

            let reviewedCount = 0;
            for (const b of batch) {
                const raw = parsed[b.contentHash];
                const suggestions = Array.isArray(raw)
                    ? raw
                          .filter((s): s is string => typeof s === "string")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                          .slice(0, 3)
                    : [];
                const serverHash = createHash("sha256").update((b.markdown ?? "").trim()).digest("hex");
                if (serverHash !== b.contentHash) continue;
                // Only persist rows that actually have suggestions, to avoid clutter.
                if (suggestions.length > 0) {
                    await upsertDocumentReviewFeedback(input.documentId, b.contentHash, suggestions);
                    reviewedCount += 1;
                }
            }

            return { didRun: true, reviewedCount };
        }),

    /**
     * Get per-document reviewing criteria (for configuring the passive reviewer).
     */
    getReviewCriteria: protectedProcedure
        .use(aiRateLimit)
        .input(z.object({ documentId: z.string().uuid() }))
        .query(async ({ input }) => {
            const criteria = await getDocumentReviewCriteria(input.documentId);
            return { criteria };
        }),

    /**
     * Set per-document reviewing criteria.
     */
    setReviewCriteria: protectedProcedure
        .use(aiRateLimit)
        .input(
            z.object({
                documentId: z.string().uuid(),
                criteria: z.string().max(10_000),
            }),
        )
        .mutation(async ({ input }) => {
            await upsertDocumentReviewCriteria(input.documentId, input.criteria.trim());
            return { success: true };
        }),
});

function buildSystemPrompt(documentContext: string | undefined): string {
    const base = `You are a professional writing assistant. Your task is to provide ONLY the requested content. 
    If providing a code block, indicate the language (e.g., \`\`\`python).`;

    if (documentContext == null || documentContext.trim() === "") {
        return `${base}\n\nStrict Rule: Start your response immediately with the content. No "Sure," "Okay," or introductions.`;
    }

    return `${base}

## Document Context
The user is editing a document. Use this for style and context:
\`\`\`markdown
${documentContext.trim()}
\`\`\`

## Response Rules
1. **Zero Preamble:** Do not include introductory phrases (e.g., "Sure," "Here is," "Okay").
2. **Direct Output:** Start the response with the first word of the actual content requested.
3. **No Meta-Talk:** Do not acknowledge the user or explain your thought process.
4. **Consistency:** Match the tone and markdown formatting of the Document Context above.

**Example of BAD response:** "Sure! Here is the list: 1. Item A..."
**Example of GOOD response:** "1. Item A..."`;

}
