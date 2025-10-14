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
                model: google("gemini-2.0-flash"),
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
        }),
    generateForPrompt: publicProcedure
    .input(z.object({
        prompt: z.string(),
        content: z.string()
    }))
    .mutation(async function* ({ input }) {
        const { textStream } = streamText({
            model: google("gemini-2.0-flash"),
            system: systemPrompt,
            prompt: input.prompt + input.content,
            experimental_transform: smoothStream({
                delayInMs: 20,
                chunking: "word"
            }),
        });

        // const textStream = ['this ', ' is', ' a', ' test', ' stream'];

        // const textStream = input.prompt.split(' ').map(word => word + ' ');

        for await (const text of textStream) {
            console.log(text);
            yield text;
            // await new Promise(resolve => setTimeout(resolve, 30));
        }
    }),
    generateForFollowUp: publicProcedure
    .input(z.object({
        initialPrompt: z.string(),
        followUp: z.string(),
        lastGeneratedContent: z.string(),
        content: z.string()
    }))
    .mutation(async function* ({ input }) {
        const { textStream } = streamText({
            model: google("gemini-2.0-flash"),
            system: systemPrompt,
            prompt: `${systemPrompt}\n\nInitial prompt: ${input.initialPrompt}\n\nLast generated content: ${input.lastGeneratedContent}\n\nFollow-up request: ${input.followUp}\n\nCurrent document content: ${input.content}`,
            experimental_transform: smoothStream({
                delayInMs: 20,
                chunking: "word"
            }),
        });

        // For testing, simulate a follow-up response
        // const followUpText = `Based on your follow-up "${input.followUp}", here's an updated response that builds on the previous content: ${input.lastGeneratedContent}`;
        // const textStream = followUpText.split(' ').map(word => word + ' ');

        for await (const text of textStream) {
            yield text;
            // await new Promise(resolve => setTimeout(resolve, 30));
        }
    })
});

const systemPrompt = `You are a writing assistant. Respond to the provided input by perfoming the instructed action. You are to respond as if you are the author of the content you are writing for. If providing a codeblock, indicate the language e.g., \`\`\`python\nprint("Hello, world!")\n\`\`\`:`