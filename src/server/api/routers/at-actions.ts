import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod"

export const atActionsRouter = createTRPCRouter({
    summarize: publicProcedure
        .input(z.string())
        .mutation(async ({ input }) => {
            return `input: ${input.slice(0, 5)}`
        })
});