import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"
import { streamText, smoothStream } from "ai"
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
                model: google("models/gemini-1.5-flash"),
                system: systemPrompt,
                prompt: `${atActionsConfig[input.action].prompt} ${input.content}`,
                experimental_continueSteps: true,
                experimental_transform: smoothStream({
                    delayInMs: 20,
                    chunking: 'line',
                }),
                onFinish({ finishReason }) {
                    console.log('finish reason: ' + finishReason)
                },
            });

            for await (const text of textStream) {
                console.log(text)
                yield text;
            }
        })
});

const systemPrompt = `You are a Markdown assistant. Follow these instructions to produce an augmented markdown output for the provided input. The output will be parsed into another format so follow thse instructions strictly: 

Any line that belongs to a table, start with <table-tag>, e.g., <table-tag>| table heading |. 

For numbered lists, start with <numbered-list-tag> and end with <numbered-list-tag> at the end of the list
e.g., <numbered-list-tag>1. list item 2. list item 2 3. list item3<numbered-list-tag>.
Make sure that the tag is only added immediately before and after the ENTIRE list, DO NOT add the tags on each list item.
Do not add the tags for nested lists. Only add the tags for the top level list.
Do not nest codeblocks inside lists. Make sure to always add the list tags even when there are other elements between list items.

Use a single space instead of multiple spaces for nested list items

Also do not include extra whitespace before a numbered list item. or codeblock`