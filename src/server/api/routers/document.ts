import { type Block } from "@blocknote/core";
import { z } from "zod"

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { 
  createDocument, 
  saveDocument, 
  getDocumentById, 
  getLastUpdatedTimestamp, 
  getDocumentIdsForUser as getDocumentsIdsForUser, 
  updateDocumentName, 
  persistDocumentSnapshot, 
  getLatestDocumentSnapshot,
  saveDocumentChange,
  saveDocumentChanges,
  getDocumentChanges,
} from '~/server/db'

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
        .input(documentSchema.omit({ name: true }))
        .mutation(async ({ input }) => {
            return saveDocument(input);
        }),
    updateDocumentName: publicProcedure
        .input(z.object({
            id: z.string(),
            name: z.string(),
        }))
        .mutation(async ({ input }) => {
            return updateDocumentName(input.id, input.name);
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
    getDocumentIdsForAuthenticatedUser: publicProcedure
        .query(async () => {
            return getDocumentsIdsForUser();
        }),
        persistDocumentSnapshot: publicProcedure
        .input(z.object({
          documentId: z.string(),
          snapshotData: z.string(), // base64 string
        }))
        .mutation(async ({ input }) => {
          // 🚫 DO NOT decode
          return persistDocumentSnapshot(
            input.documentId,
            input.snapshotData
          );
        }),
    getLatestDocumentSnapshot: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            return getLatestDocumentSnapshot(input);
        }),

    // =============================================================================
    // CRDT-based document changes (new approach)
    // =============================================================================

    /**
     * Save a single Yjs update to the changes table.
     * Duplicates are ignored via unique constraint.
     */
    saveDocumentChange: publicProcedure
        .input(z.object({
            documentId: z.string(),
            clientId: z.string(),
            clock: z.number(),
            updateData: z.string(), // base64 encoded Yjs update
        }))
        .mutation(async ({ input }) => {
            return saveDocumentChange(
                input.documentId,
                input.clientId,
                input.clock,
                input.updateData
            );
        }),

    /**
     * Batch save multiple Yjs updates at once.
     * More efficient for saving multiple changes.
     */
    saveDocumentChanges: publicProcedure
        .input(z.object({
            documentId: z.string(),
            changes: z.array(z.object({
                clientId: z.string(),
                clock: z.number(),
                updateData: z.string(),
            })),
        }))
        .mutation(async ({ input }) => {
            return saveDocumentChanges(input.documentId, input.changes);
        }),

    /**
     * Get all changes for a document to rebuild CRDT state.
     * Returns changes in order so they can be applied sequentially.
     */
    getDocumentChanges: publicProcedure
        .input(z.string())
        .query(async ({ input }) => {
            return getDocumentChanges(input);
        }),
});
