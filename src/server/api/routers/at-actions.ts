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
                prompt: `summarize this text in markdown. Use a variety of markdown elements such as bullets, tables, and different kinds of text: ${input}`,
                experimental_continueSteps: true,
                onFinish({ finishReason }) {
                    // your own logic, e.g. for saving the chat history or recording usage

                    console.log(finishReason)
                },
            });

            for await (const text of result.fullStream) {
                yield text;
            }

            // console.log(result.finishReason)
        })
});