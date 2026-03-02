/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- tRPC procedure chain types are correct but not inferred through middleware */
import { createTRPCRouter, protectedProcedure, rateLimitMiddleware } from "../trpc";
import { z } from "zod";
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions";
import { MAX_PROMPT_LENGTH } from "~/app/ai/prompt/constants";

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

type QuickGenerateInput = z.infer<typeof quickGenerateInputSchema>;
type GenerateForPromptInput = z.infer<typeof generateForPromptInputSchema>;

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
