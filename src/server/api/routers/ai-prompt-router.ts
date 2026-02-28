import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions"

const DEFAULT_MODEL = 'gemma-3-1b-it';

export const aiPromptRouter = createTRPCRouter({
    quickGenerateAction: publicProcedure
        .input(z.object({
            action: z.nativeEnum(AtAction),
            content: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model: google(DEFAULT_MODEL),
                system: buildSystemPrompt(undefined),
                prompt: `${atActionsConfig[input.action].prompt} ${input.content}`,
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: "word"
                }),
            });

            for await (const text of textStream) {
                yield text;
            }
        }),

    generateForPrompt: publicProcedure
        .input(
            z
                .object({
                    prompt: z.string(),
                    documentContext: z.string().optional(),
                    previousResponse: z.string().optional(),
                    followUp: z.string().optional(),
                })
                .refine(
                    (data) => {
                        const hasFollowUp = data.followUp != null && data.followUp !== "";
                        const hasPrevious = data.previousResponse != null && data.previousResponse !== "";
                        return hasFollowUp === hasPrevious;
                    },
                    { message: "previousResponse and followUp must both be provided for a follow-up" }
                )
        )
        .mutation(async function* ({ input }) {
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
