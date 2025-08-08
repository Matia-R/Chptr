import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText, generateText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"
import { AtAction, atActionsConfig } from "~/app/ai/prompt/at-actions"

export const atActionsRouter = createTRPCRouter({
    generate: publicProcedure
        .input(z.object({
            action: z.nativeEnum(AtAction),
            content: z.string()
        }))
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model: google("gemini-1.5-flash"),
                system: systemPrompt,
                prompt: `${atActionsConfig[input.action].prompt} ${input.content}`,
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: "word"
                }),
            });

            for await (const text of textStream) {
                console.log(text)
                yield text;
            }
        })
});

const systemPrompt = `You are a writing assistant. Respond to the provided input by perfoming the instructed action:`