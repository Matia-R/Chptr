import { createClient } from '~/utils/supabase/server'
import { randomUUID } from 'crypto'
import { TRPCError } from '@trpc/server'
import * as Y from 'yjs'

/** Passed from tRPC context to avoid redundant createClient() + getUser() per request. */
export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

type DocumentSchema = {
    id: string;
    creator_id: string;
    name: string;
    last_updated?: Date;
}

type DocumentPermissionSchema = {
    id: string;
    user_id: string;
    document_id: string;
    permission: string;
}

type UserProfile = {
    updated_at: string,
    avatar_url: string,
    first_name: string,
    last_name: string,
    default_avatar_background_color: string,
};

type DocumentSnapshotRow = {
    snapshot_data: string;
    snapshot_cutoff_created_at: string;
};

/** Map Supabase/PostgREST document-query errors to TRPC errors (NOT_FOUND, BAD_REQUEST, INTERNAL). */
function throwOnDocumentQueryError(
    error: { code?: string; message?: string },
    context: string
): never {
    if (error.code === 'PGRST116' || (error.message?.includes('Cannot coerce') ?? false)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
    }
    if (error.message?.includes('invalid input syntax for type uuid')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid document ID format' });
    }
    throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `${context}: ${error.message ?? 'Unknown error'}`,
    });
}

export async function createDocument(auth?: AuthContext) {
    const supabase = auth?.supabase ?? await createClient();
    const currentUserId = auth?.userId ?? (await supabase.auth.getUser()).data.user?.id;

    const newDocumentId = randomUUID()

    const { data, error } = await supabase
        .from('documents')
        .insert({
            id: newDocumentId,
            creator_id: currentUserId,
            name: 'Untitled',
        })
        .select()

    if (error) throw new Error(`Failed to create document: ${error.message}`)
    return { success: true, createdDocument: data }
}

export async function getDocumentById(
    documentId: string,
    opts?: { supabase?: Awaited<ReturnType<typeof createClient>> }
) {
    const supabase = opts?.supabase ?? (await createClient());

    const { data, error } = await supabase
        .from('documents')
        .select('id, creator_id, name, last_updated')
        .eq('id', documentId)
        .single() as { data: DocumentSchema | null, error: { code?: string; message?: string } | null }

    if (error) {
        throwOnDocumentQueryError(error, 'Failed to fetch document');
    }
    return { success: true, document: data }
}

export async function getLastUpdatedTimestamp(
    documentId: string,
    opts?: { supabase?: Awaited<ReturnType<typeof createClient>> }
) {
    const supabase = opts?.supabase ?? (await createClient());

    const { data, error } = await supabase
        .from('documents')
        .select('last_updated')
        .eq('id', documentId)
        .single() as { data: Pick<DocumentSchema, 'last_updated'> | null, error: Error | null }

    if (error) throw new Error(`Failed to fetch last updated timestamp: ${error.message}`)
    return { success: true, lastUpdated: data?.last_updated }
}

export const getDocumentIdsForUser = async (auth?: AuthContext) => {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let userId: string | undefined;
    if (auth) {
        supabase = auth.supabase;
        userId = auth.userId;
    } else {
        supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
    }
    if (!userId) {
        return { success: true, documents: [] };
    }

    const { data, error } = await supabase
        .from('document_permissions')
        .select(`
            document_id,
            documents:document_id (
                name,
                last_updated
            )
        `)
        .eq('user_id', userId)
        .order('documents(last_updated)', { ascending: false }) as { data: (DocumentPermissionSchema & { documents: Pick<DocumentSchema, 'name' | 'last_updated'> })[] | null, error: Error | null }

    const documents = data?.map((permission) => ({
        id: permission.document_id,
        name: permission.documents.name
    }))

    if (error) throw new Error(`Failed to fetch documents for user: ${error.message}`)
    return { success: true, documents }
}

export async function updateDocumentName(
    documentId: string,
    name: string,
    auth?: AuthContext
) {
    const supabase = auth?.supabase ?? await createClient();
    const user = auth ? { id: auth.userId } : await getAuthenticatedUser(supabase);

    const { data: existingDoc, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .single();

    if (docError && docError.code !== 'PGRST116') {
        throw new Error(`Failed to check document: ${docError.message}`);
    }

    if (!existingDoc) {
        await createDocumentWithPermission(supabase, documentId, user.id, name);
        return { success: true, created: true };
    }

    const { data: permission, error: permCheckError } = await supabase
        .from('document_permissions')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .single();

    if (permCheckError && permCheckError.code !== 'PGRST116') {
        throw new Error(`Failed to check permission: ${permCheckError.message}`);
    }

    if (!permission) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to edit this document',
        });
    }

    // Update the document name
    const { error: updateError } = await supabase
        .from('documents')
        .update({
            name,
            last_updated: new Date()
        })
        .eq('id', documentId);

    if (updateError) {
        throw new Error(`Failed to update document name: ${updateError.message}`);
    }

    return { success: true, created: false };
}

/**
 * Returns the current authenticated user. Throws UNAUTHORIZED if not logged in.
 */
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
        });
    }
    return user;
}

/**
 * Creates a document and an owner permission for the user.
 * Idempotent: ignores 23505 (unique violation) for document or permission.
 */
async function createDocumentWithPermission(
    supabase: Awaited<ReturnType<typeof createClient>>,
    documentId: string,
    userId: string,
    name = 'Untitled'
) {
    const { error: createError } = await supabase
        .from('documents')
        .insert({
            id: documentId,
            creator_id: userId,
            name,
            ...(name !== 'Untitled' ? { last_updated: new Date() } : {}),
        });

    if (createError && createError.code !== '23505') {
        throw new Error(`Failed to create document: ${createError.message}`);
    }

    const { error: permError } = await supabase
        .from('document_permissions')
        .insert({
            user_id: userId,
            document_id: documentId,
            permission: 'owner',
        });

    if (permError && permError.code !== '23505') {
        throw new Error(`Failed to create document permission: ${permError.message}`);
    }
}

/**
 * Ensures the user has permission to mutate the document (e.g. save changes).
 * If the document does not exist, creates it and an owner permission for the user.
 * If the document exists but the user has no permission, throws FORBIDDEN.
 * Throws INTERNAL_SERVER_ERROR on any DB query failure so we never treat a failed
 * query as "no record" and incorrectly FORBIDDEN or auto-create.
 */
async function ensureCanMutateDocument(
    supabase: Awaited<ReturnType<typeof createClient>>,
    documentId: string,
    userId: string
) {
    const { data: permission, error: permError } = await supabase
        .from('document_permissions')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .single();

    if (permError && permError.code !== 'PGRST116') {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to check document permission',
            cause: permError,
        });
    }

    if (permission) return;

    const { data: existingDoc, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .single();

    if (docError && docError.code !== 'PGRST116') {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to check document existence',
            cause: docError,
        });
    }

    if (existingDoc) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this document',
        });
    }

    await createDocumentWithPermission(supabase, documentId, userId, 'Untitled');
}

export async function getCurrentUser(auth?: AuthContext): Promise<string | undefined> {
    const supabase = auth?.supabase ?? await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    return user.email;
}

export async function getCurrentUserProfile(auth?: AuthContext): Promise<UserProfile | undefined> {
    const supabase = auth?.supabase ?? await createClient();
    const userId = auth?.userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<UserProfile>();
    if (error) throw new Error('Failed to fetch user profile');
    return data;
}

// =============================================================================
// CRDT-based document changes (new approach)
// =============================================================================
// Supabase/PostgREST can return bytea as base64 or hex in JSON. Normalize to base64 for the API.

/** Convert bytea response (base64 or hex from PostgREST) to base64 so the client can always use atob(). */
function byteaResponseToBase64(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('\\x') || trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const hex = trimmed.replace(/^\\x|^0x|^0X/i, '').replace(/\s/g, '');
    return Buffer.from(hex, 'hex').toString('base64');
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex').toString('base64');
  }
  return trimmed;
}

/** Convert base64 (from API) to Postgres bytea input format (hex with \\x prefix) for INSERT/UPDATE. */
function base64ToByteaHex(base64: string): string {
  const buf = Buffer.from(base64, 'base64');
  return '\\x' + buf.toString('hex');
}

import { COMPACTION_CAP } from '~/server/document-compaction';

/**
 * Save a single Yjs update to the document_changes table.
 * Uses unique constraint (document_id, client_id, clock) to prevent duplicates.
 * This allows every client to write every update they see (local or remote).
 */
export async function saveDocumentChange(
  documentId: string,
  clientId: string,
  clock: number,
  updateData: string,
  auth?: AuthContext
) {
  const supabase = auth?.supabase ?? await createClient();
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id;
  await ensureCanMutateDocument(supabase, documentId, userId);

  // Insert the change (unique constraint handles duplicates). bytea column expects hex.
  const { error } = await supabase
    .from('document_changes')
    .insert({
      document_id: documentId,
      client_id: clientId,
      clock,
      update_data: base64ToByteaHex(updateData),
    });

  // Ignore duplicate key errors (23505) - this is expected with CRDT
  if (error && error.code !== '23505') {
    throw new Error(`Failed to save document change: ${error.message}`);
  }

  return { success: true };
}

/**
 * Batch save multiple Yjs updates at once.
 * More efficient than saving one at a time.
 */
export async function saveDocumentChanges(
  documentId: string,
  changes: Array<{ clientId: string; clock: number; updateData: string }>,
  auth?: AuthContext
) {
  const supabase = auth?.supabase ?? await createClient();
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id;
  await ensureCanMutateDocument(supabase, documentId, userId);

  // Batch insert (upsert to handle duplicates gracefully). bytea column expects hex.
  const rows = changes.map(c => ({
    document_id: documentId,
    client_id: c.clientId,
    clock: c.clock,
    update_data: base64ToByteaHex(c.updateData),
  }));

  const { error } = await supabase
    .from('document_changes')
    .upsert(rows, { 
      onConflict: 'document_id,client_id,clock',
      ignoreDuplicates: true 
    });

  if (error) {
    throw new Error(`Failed to save document changes: ${error.message}`);
  }

  return { success: true, count: changes.length };
}

/**
 * Get snapshot + tail for a document. Returns latest snapshot (if any) and only
 * changes after the snapshot cutoff so the client can apply snapshot then tail.
 * Tail uses index (document_id, created_at). For one DB round trip, consider a
 * Postgres RPC that returns snapshot row + tail rows in a single call.
 */
export async function getDocumentChanges(documentId: string, auth?: AuthContext) {
  const supabase = auth?.supabase ?? await createClient();
  if (!auth) {
    // Ensure the caller is authenticated; row-level security will handle per-row permissions.
    await getAuthenticatedUser(supabase);
  }

  // 1) Check document existence (RLS on documents still applies).
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .single();

  if (docError) {
    throwOnDocumentQueryError(docError as { code?: string; message?: string }, 'Failed to fetch document');
  }
  if (!doc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
  }

  // 2) Fetch snapshot row (if any).
  const snapshotResult = await supabase
    .from('document_snapshots')
    .select('snapshot_data, snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single();

  const snapshotRow = snapshotResult.data as DocumentSnapshotRow | null;
  const snapshot: string | null = snapshotRow?.snapshot_data
    ? byteaResponseToBase64(snapshotRow.snapshot_data)
    : null;
  const snapshotCutoffCreatedAt: string | null =
    snapshotRow?.snapshot_cutoff_created_at ?? null;

  // 3) Fetch tail: all changes after snapshot cutoff (or all if no cutoff) in a single query.
  let changesQuery = supabase
    .from('document_changes')
    .select('update_data, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (snapshotCutoffCreatedAt) {
    changesQuery = changesQuery.gt('created_at', snapshotCutoffCreatedAt);
  }

  const { data: changesRows, error: changesError } = await changesQuery;
  if (changesError) {
    throw new Error(`Failed to fetch document changes: ${changesError.message}`);
  }

  const tailRows =
    (changesRows as Array<{ update_data: string; created_at: string }> | null) ?? [];

  const changes = tailRows.map((row) => ({
    updateData: byteaResponseToBase64(row.update_data),
  }));

  return {
    success: true,
    snapshot,
    snapshotCutoffCreatedAt,
    changes,
  };
}

/**
 * Count tail rows (changes after current snapshot). Used to decide whether to compact.
 */
export async function getDocumentTailCount(
  documentId: string,
  auth?: AuthContext
): Promise<number> {
  const supabase = auth?.supabase ?? await createClient();
  if (!auth) await getAuthenticatedUser(supabase);

  const { data: snapshotRow } = await supabase
    .from('document_snapshots')
    .select('snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single();

  let query = supabase
    .from('document_changes')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId);
  if (snapshotRow?.snapshot_cutoff_created_at) {
    query = query.gt('created_at', snapshotRow.snapshot_cutoff_created_at);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count document tail: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Base64-encode a Uint8Array (Node).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Build Yjs state from snapshot + tail and return base64-encoded state update.
 */
function buildSnapshotFromSnapshotAndTail(
  snapshotBase64: string | null,
  tailRows: Array<{ update_data: string; created_at: string }>
): { snapshotData: string; cutoffCreatedAt: string } {
  const ydoc = new Y.Doc();
  if (snapshotBase64) {
    const snapshotBytes = base64ToUint8Array(snapshotBase64);
    Y.applyUpdate(ydoc, snapshotBytes);
  }
  for (const row of tailRows) {
    const updateBytes = base64ToUint8Array(byteaResponseToBase64(row.update_data));
    Y.applyUpdate(ydoc, updateBytes);
  }
  const stateUpdate = Y.encodeStateAsUpdate(ydoc);
  const cutoff =
    tailRows.length > 0
      ? tailRows[tailRows.length - 1]!.created_at
      : (snapshotBase64 ? new Date().toISOString() : '');
  return {
    snapshotData: uint8ArrayToBase64(stateUpdate),
    cutoffCreatedAt: cutoff,
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = Buffer.from(base64.trim(), 'base64');
  return new Uint8Array(binary);
}

/**
 * Compact document: merge snapshot + tail into a new snapshot and delete the tail.
 * Processes at most COMPACTION_CAP tail rows per run for timeout safety.
 */
export async function compactDocument(
  documentId: string,
  auth?: AuthContext
): Promise<void> {
  const supabase = auth?.supabase ?? await createClient();
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id;
  await ensureCanMutateDocument(supabase, documentId, userId);

  const { data: rawSnapshotRow } = await supabase
    .from('document_snapshots')
    .select('snapshot_data, snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single();

  const snapshotRow = rawSnapshotRow as DocumentSnapshotRow | null;
  const snapshotBase64 = snapshotRow?.snapshot_data
    ? byteaResponseToBase64(snapshotRow.snapshot_data)
    : null;
  const cutoffAfter = snapshotRow?.snapshot_cutoff_created_at ?? null;

  // Load tail (cap for timeout safety). Use large page to minimize round-trips.
  const PAGE_SIZE = 5000;
  const tailRows: Array<{ id: string; update_data: string; created_at: string }> = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore && tailRows.length < COMPACTION_CAP) {
    const limit = Math.min(PAGE_SIZE, COMPACTION_CAP - tailRows.length);
    let tailQuery = supabase
      .from('document_changes')
      .select('id, update_data, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (cutoffAfter) {
      tailQuery = tailQuery.gt('created_at', cutoffAfter);
    }
    const { data: page, error } = await tailQuery;
    if (error) {
      throw new Error(`Failed to fetch tail for compaction: ${error.message}`);
    }
    const rows = (page ?? []) as Array<{ id: string; update_data: string; created_at: string }>;
    tailRows.push(...rows);
    hasMore = rows.length === limit;
    offset += limit;
  }

  if (tailRows.length === 0) {
    return;
  }

  const { snapshotData, cutoffCreatedAt } = buildSnapshotFromSnapshotAndTail(
    snapshotBase64,
    tailRows
  );

  const { error: upsertError } = await supabase
    .from('document_snapshots')
    .upsert(
      {
        document_id: documentId,
        snapshot_data: base64ToByteaHex(snapshotData),
        snapshot_cutoff_created_at: cutoffCreatedAt,
      },
      { onConflict: 'document_id' }
    );
  if (upsertError) {
    throw new Error(`Failed to upsert snapshot: ${upsertError.message}`);
  }

  const compactedIds = tailRows.map((r) => r.id);
  const { error: deleteError } = await supabase
    .from('document_changes')
    .delete()
    .in('id', compactedIds);
  if (deleteError) {
    throw new Error(`Failed to delete compacted changes: ${deleteError.message}`);
  }
}

