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
                model: google("gemini-2.0-flash-exp"),
                system: systemPrompt,
                prompt: `${atActionsConfig[input.action].prompt} ${input.content}`,
                // experimental_continueSteps: true,
                // experimental_transform: smoothStream({
                //     delayInMs: 20,
                //     // chunking: 'line',
                // }),
                // onFinish({ finishReason }) {
                //     console.log('finish reason: ' + finishReason)
                // },
            });

            for await (const text of textStream) {
                console.log(text)
                yield text;
            }
        })
});

const systemPrompt = `You are a Markdown assistant. Follow these instructions to produce an augmented markdown output for the provided input. The output will be parsed into another format so follow thse instructions strictly: 

When you want to insert a table, DO NOT write it in markdown. Instead, emit a JSON object prefixed by [[tool: and suffixed by ]]. Example:
[[tool:{"tool_call":"addTableBlock","args":{"rows":[["A", "B"],["C", "D"]]}}]]
`