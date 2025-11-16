import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions"

const model = google("gemini-2.0-flash");

export const aiGenerateRouter = createTRPCRouter({
    generate: publicProcedure
        .input(z.object({
            action: z.nativeEnum(AtAction),
            content: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model,
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
        .input(z.object({
            prompt: z.string(),
            context: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model,
                system: systemPrompt,
                prompt: `${input.prompt} ${input.context}`,
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: "word"
                }),
            });

            for await (const text of textStream) {
                yield text;
            }
        })
});

const systemPrompt = `You are a writing assistant. Respond to the provided input by perfoming the instructed action. If providing a codeblock, indicate the language e.g., \`\`\`python\nprint("Hello, world!")\n\`\`\`:`