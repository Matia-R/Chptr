import { z } from "zod";

import type { AuthContext } from "~/server/db";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { COMPACTION_TAIL_THRESHOLD } from "~/server/document-compaction";
import {
  createDocument,
  getDocumentById,
  getLastUpdatedTimestamp,
  getDocumentIdsForUser as getDocumentsIdsForUser,
  updateDocumentName,
  saveDocumentChange,
  saveDocumentChanges,
  getDocumentChanges,
  getDocumentTailCount,
  compactDocument,
  getPublicationByDocumentId,
  getPublicationOwnerPathSegmentForDocument,
  publishDocument,
  unpublishDocument,
} from "~/server/db";

function authFromCtx(ctx: { user: { id: string }; supabase: AuthContext["supabase"] }): AuthContext {
  return { supabase: ctx.supabase, userId: ctx.user.id };
}

export interface Document {
    id: string,
    name: string,
    lastUpdated: Date,
}

export const documentRouter = createTRPCRouter({
    createDocument: protectedProcedure
        .mutation(async ({ ctx }) => {
            return createDocument(authFromCtx(ctx));
        }),
    updateDocumentName: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            return updateDocumentName(input.id, input.name, authFromCtx(ctx));
        }),
    getDocumentById: publicProcedure
        .input(z.string())
        .query(async ({ input, ctx }) => {
            const supabase = ctx.supabase as AuthContext["supabase"] | undefined;
            return getDocumentById(input, supabase != null ? { supabase } : undefined);
        }),
    getDocumentLastUpdated: publicProcedure
        .input(z.string())
        .query(async ({ input, ctx }) => {
            const supabase = ctx.supabase as AuthContext["supabase"] | undefined;
            return getLastUpdatedTimestamp(input, supabase != null ? { supabase } : undefined);
        }),
    getLastUpdatedTimestamp: publicProcedure
        .input(z.string())
        .query(async ({ input, ctx }) => {
            const supabase = ctx.supabase as AuthContext["supabase"] | undefined;
            return getLastUpdatedTimestamp(input, supabase != null ? { supabase } : undefined);
        }),
    getDocumentIdsForAuthenticatedUser: publicProcedure
        .query(async ({ ctx }) => {
            return getDocumentsIdsForUser(
                ctx.user && ctx.supabase ? authFromCtx(ctx as { user: { id: string }; supabase: AuthContext["supabase"] }) : undefined
            );
        }),

    // =============================================================================
    // CRDT-based document changes (new approach)
    // =============================================================================

    /**
     * Save a single Yjs update to the changes table.
     * Duplicates are ignored via unique constraint.
     */
    saveDocumentChange: protectedProcedure
        .input(z.object({
            documentId: z.string(),
            clientId: z.string(),
            clock: z.number(),
            updateData: z.string(), // base64 encoded Yjs update
        }))
        .mutation(async ({ input, ctx }) => {
            return saveDocumentChange(
                input.documentId,
                input.clientId,
                input.clock,
                input.updateData,
                authFromCtx(ctx)
            );
        }),

    /**
     * Batch save multiple Yjs updates at once.
     * More efficient for saving multiple changes.
     */
    saveDocumentChanges: protectedProcedure
        .input(z.object({
            documentId: z.string(),
            changes: z.array(z.object({
                clientId: z.string(),
                clock: z.number(),
                updateData: z.string(),
            })),
        }))
        .mutation(async ({ input, ctx }) => {
            const auth = authFromCtx(ctx);
            const result = await saveDocumentChanges(input.documentId, input.changes, auth);
            try {
                const tailCount = await getDocumentTailCount(input.documentId, auth);
                if (tailCount >= COMPACTION_TAIL_THRESHOLD) {
                    await compactDocument(input.documentId, auth);
                }
            } catch (err) {
                console.error("[saveDocumentChanges] Compaction failed (best-effort):", err);
            }
            return result;
        }),

    /**
     * Get all changes for a document to rebuild CRDT state.
     * Returns changes in order so they can be applied sequentially.
     */
    getDocumentChanges: protectedProcedure
        .input(z.string())
        .query(async ({ input, ctx }) => {
            return getDocumentChanges(input, authFromCtx(ctx));
        }),

    getPublicationByDocumentId: protectedProcedure
        .input(z.string().uuid())
        .query(async ({ input, ctx }) => {
            return getPublicationByDocumentId(input, authFromCtx(ctx));
        }),

    /** Owner's URL prefix: `username` if set, else `firstname`+`lastname` (document owner, not current user). */
    getPublicationOwnerPathSegment: protectedProcedure
        .input(z.string().uuid())
        .query(async ({ input, ctx }) => {
            return getPublicationOwnerPathSegmentForDocument(input, authFromCtx(ctx));
        }),

    publishDocument: protectedProcedure
        .input(
            z.object({
                documentId: z.string().uuid(),
                title: z.string().min(1).max(500),
                bodyHtml: z.string().min(1).max(3_000_000),
                blocksJson: z.string().max(8_000_000),
                slug: z.string().min(1).max(200).optional(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            return publishDocument(
                {
                    documentId: input.documentId,
                    title: input.title,
                    bodyHtml: input.bodyHtml,
                    blocksJson: input.blocksJson,
                    slug: input.slug,
                },
                authFromCtx(ctx),
            );
        }),

    unpublishDocument: protectedProcedure
        .input(z.string().uuid())
        .mutation(async ({ input, ctx }) => {
            return unpublishDocument(input, authFromCtx(ctx));
        }),
});
