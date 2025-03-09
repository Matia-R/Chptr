import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText } from "ai"
import { google } from "@ai-sdk/google"

export const atActionsRouter = createTRPCRouter({
    summarize: publicProcedure
        .input(z.string())
        .mutation(async function* ({ input }) {
            const result = streamText({
                model: google("models/gemini-2.0-flash-exp"),
                prompt: `create a markdown table for the following: ${input}`,
                experimental_continueSteps: true,
                onFinish({ finishReason }) {
                    // your own logic, e.g. for saving the chat history or recording usage

                    console.log('finish reason: ' + finishReason)
                },
            });

            for await (const text of result.fullStream) {
                yield text;
            }

            // console.log(result.finishReason)
        })
});