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
                system: systemPrompt,
                prompt: `summarize this text thoroughly. Include a table, numbered list, bulleted list, nested list and a codeblock: ${input}`,
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

const systemPrompt = `You are a Markdown assistant. Follow these instructions to produce an augmented markdown output for the provided input. The output will be parsed into another format so follow thse instructions strictly: 

Any line that belongs to a table, start with <table-tag>, e.g., <table-tag>| table heading |. 

For numbered lists, start with <numbered-list-tag> and end with <numbered-list-tag> at the end of the list
e.g., <numbered-list-tag>1. list item 2. list item 2 3. list item3<numbered-list-tag>.
Make sure that the tag is only added immediately before and after the ENTIRE list, DO NOT add the tags on each list item.
Do not add the tags for nested lists. Only add the tags for the top level list.
Do not nest codeblocks inside lists. Make sure to always add the list tags even when there are other elements between list items.

Use a single space instead of multiple spaces for nested list items

Also do not include extra whitespace before a numbered list item. or codeblock`