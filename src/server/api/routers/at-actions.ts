import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText, smoothStream } from "ai"
import { google } from "@ai-sdk/google"

export const atActionsRouter = createTRPCRouter({
    summarize: publicProcedure
        .input(z.string())
        .mutation(async function* ({ input }) {
            const { textStream } = streamText({
                model: google("models/gemini-1.5-flash"),
                prompt: `summarize this text in markdown with thorough points. Use a variety of elements including a small table: ${input}`,
                experimental_continueSteps: true,
                experimental_transform: smoothStream({
                    delayInMs: 20, // optional: defaults to 10ms
                    chunking: 'line', // optional: defaults to 'word'
                }),
                onFinish({ finishReason }) {
                    // your own logic, e.g. for saving the chat history or recording usage

                    console.log('finish reason: ' + finishReason)
                },
            });

            for await (const text of textStream) {
                console.log(text)
                yield text;
            }

            // console.log(result.finishReason)
        })
});