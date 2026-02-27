import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions"

export const aiPromptRouter = createTRPCRouter({
    quickGenerateAction: publicProcedure
        .input(z.object({
            action: z.nativeEnum(AtAction),
            content: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model: google("gemini-flash-lite-latest"),
                system: systemPrompt,
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

            const { textStream } = streamText({
                model: google("gemini-flash-latest"),
                system: systemPrompt,
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

const systemPrompt = `You are a writing assistant. Respond to the provided input by perfoming the instructed action. If providing a codeblock, indicate the language e.g., \`\`\`python\nprint("Hello, world!")\n\`\`\`:`;
