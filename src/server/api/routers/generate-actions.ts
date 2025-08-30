import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { GenerateAction, generateActionsConfig } from "~/app/ai/prompt/generate-actions-config"

export const generateActionsRouter = createTRPCRouter({
    generate: publicProcedure
        .input(z.object({
            action: z.nativeEnum(GenerateAction),
            content: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model: google("gemini-1.5-flash"),
                system: systemPrompt,
                prompt: `${generateActionsConfig[input.action].prompt} ${input.content}`,
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