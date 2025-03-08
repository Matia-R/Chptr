import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { generateText, streamText } from "ai"
import { google } from "@ai-sdk/google"

export const atActionsRouter = createTRPCRouter({
    summarize: publicProcedure
        .input(z.string())
        .mutation(async function* ({ input }) {
            const result = streamText({
                model: google("models/gemini-2.0-flash-exp"),
                prompt: `summarize this text in markdown: ${input}`
            });

            for await (const text of result.fullStream) {
                yield text;
            }
        })
});