import { type Block } from "@blocknote/core";
import { z } from "zod"

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { createDocument, saveDocument, getDocumentById, getLastUpdatedTimestamp } from '~/server/db'

export interface Document {
    id: string,
    name: string,
    content: Block[],
    lastUpdated: Date,
}

const documentSchema = z.object({
    id: z.string(),
    name: z.string(),
    content: z.array(z.any()), // Block[] type from BlockNote
    lastUpdated: z.date()
}) satisfies z.ZodType<Document>;

export const documentRouter = createTRPCRouter({
    createDocument: publicProcedure
        .mutation(async () => {
            return createDocument();
        }),
    saveDocument: publicProcedure
        .input(documentSchema)
        .mutation(async ({ input }) => {
            return saveDocument(input);
        }),
    getDocumentById: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            return getDocumentById(input);
        }),
    getDocumentLastUpdated: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            return getLastUpdatedTimestamp(input)
        }),
    getLastUpdatedTimestamp: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            return getLastUpdatedTimestamp(input);
        }),
});
