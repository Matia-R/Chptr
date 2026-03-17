import { TRPCError } from '@trpc/server'
import * as Y from 'yjs'
import { createClient, throwOnDocumentQueryError, type AuthContext } from './shared'
import { getAuthenticatedUser } from './auth'
import { ensureCanMutateDocument } from './documents'
import { COMPACTION_CAP } from '~/server/document-compaction'

type DocumentSnapshotRow = {
  snapshot_data: string
  snapshot_cutoff_created_at: string
}

function byteaResponseToBase64(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('\\x') || trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const hex = trimmed.replace(/^\\x|^0x|^0X/i, '').replace(/\s/g, '')
    return Buffer.from(hex, 'hex').toString('base64')
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex').toString('base64')
  }
  return trimmed
}

function base64ToByteaHex(base64: string): string {
  const buf = Buffer.from(base64, 'base64')
  return '\\x' + buf.toString('hex')
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = Buffer.from(base64.trim(), 'base64')
  return new Uint8Array(binary)
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function buildSnapshotFromSnapshotAndTail(
  snapshotBase64: string | null,
  tailRows: Array<{ update_data: string; created_at: string }>
): { snapshotData: string; cutoffCreatedAt: string } {
  const ydoc = new Y.Doc()
  if (snapshotBase64) {
    const snapshotBytes = base64ToUint8Array(snapshotBase64)
    Y.applyUpdate(ydoc, snapshotBytes)
  }
  for (const row of tailRows) {
    const updateBytes = base64ToUint8Array(byteaResponseToBase64(row.update_data))
    Y.applyUpdate(ydoc, updateBytes)
  }
  const stateUpdate = Y.encodeStateAsUpdate(ydoc)
  const cutoff =
    tailRows.length > 0
      ? tailRows[tailRows.length - 1]!.created_at
      : (snapshotBase64 ? new Date().toISOString() : '')
  return {
    snapshotData: uint8ArrayToBase64(stateUpdate),
    cutoffCreatedAt: cutoff,
  }
}

export async function saveDocumentChange(
  documentId: string,
  clientId: string,
  clock: number,
  updateData: string,
  auth?: AuthContext
) {
  const supabase = auth?.supabase ?? await createClient()
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id
  await ensureCanMutateDocument(supabase, documentId, userId)

  const { error } = await supabase
    .from('document_changes')
    .insert({
      document_id: documentId,
      client_id: clientId,
      clock,
      update_data: base64ToByteaHex(updateData),
    })

  if (error && error.code !== '23505') {
    throw new Error(`Failed to save document change: ${error.message}`)
  }

  return { success: true }
}

export async function saveDocumentChanges(
  documentId: string,
  changes: Array<{ clientId: string; clock: number; updateData: string }>,
  auth?: AuthContext
) {
  const supabase = auth?.supabase ?? await createClient()
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id
  await ensureCanMutateDocument(supabase, documentId, userId)

  const rows = changes.map(c => ({
    document_id: documentId,
    client_id: c.clientId,
    clock: c.clock,
    update_data: base64ToByteaHex(c.updateData),
  }))

  const { error } = await supabase
    .from('document_changes')
    .upsert(rows, {
      onConflict: 'document_id,client_id,clock',
      ignoreDuplicates: true
    })

  if (error) {
    throw new Error(`Failed to save document changes: ${error.message}`)
  }

  return { success: true, count: changes.length }
}

export async function getDocumentChanges(documentId: string, auth?: AuthContext) {
  const supabase = auth?.supabase ?? await createClient()
  if (!auth) {
    await getAuthenticatedUser(supabase)
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .single()

  if (docError) {
    throwOnDocumentQueryError(docError as { code?: string; message?: string }, 'Failed to fetch document')
  }
  if (!doc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }

  const snapshotResult = await supabase
    .from('document_snapshots')
    .select('snapshot_data, snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single()

  if (snapshotResult.error && snapshotResult.error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch document snapshot: ${snapshotResult.error.message}`)
  }
  const snapshotRow = snapshotResult.data as DocumentSnapshotRow | null
  const snapshot: string | null = snapshotRow?.snapshot_data
    ? byteaResponseToBase64(snapshotRow.snapshot_data)
    : null
  const snapshotCutoffCreatedAt: string | null =
    snapshotRow?.snapshot_cutoff_created_at ?? null

  let changesQuery = supabase
    .from('document_changes')
    .select('update_data, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  if (snapshotCutoffCreatedAt) {
    changesQuery = changesQuery.gt('created_at', snapshotCutoffCreatedAt)
  }

  const { data: changesRows, error: changesError } = await changesQuery
  if (changesError) {
    throw new Error(`Failed to fetch document changes: ${changesError.message}`)
  }

  const tailRows =
    (changesRows as Array<{ update_data: string; created_at: string }> | null) ?? []

  const changes = tailRows.map((row) => ({
    updateData: byteaResponseToBase64(row.update_data),
  }))

  return {
    success: true,
    snapshot,
    snapshotCutoffCreatedAt,
    changes,
  }
}

export async function getDocumentTailCount(
  documentId: string,
  auth?: AuthContext
): Promise<number> {
  const supabase = auth?.supabase ?? await createClient()
  if (!auth) await getAuthenticatedUser(supabase)

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('document_snapshots')
    .select('snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single()

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch document snapshot: ${snapshotError.message}`)
  }

  let query = supabase
    .from('document_changes')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
  if (snapshotRow?.snapshot_cutoff_created_at) {
    query = query.gt('created_at', snapshotRow.snapshot_cutoff_created_at)
  }
  const { count, error } = await query
  if (error) {
    throw new Error(`Failed to count document tail: ${error.message}`)
  }
  return count ?? 0
}

export async function compactDocument(
  documentId: string,
  auth?: AuthContext
): Promise<void> {
  const supabase = auth?.supabase ?? await createClient()
  const userId = auth?.userId ?? (await getAuthenticatedUser(supabase)).id
  await ensureCanMutateDocument(supabase, documentId, userId)

  const { data: rawSnapshotRow, error: snapshotError } = await supabase
    .from('document_snapshots')
    .select('snapshot_data, snapshot_cutoff_created_at')
    .eq('document_id', documentId)
    .single()

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch document snapshot: ${snapshotError.message}`)
  }
  const snapshotRow = rawSnapshotRow as DocumentSnapshotRow | null
  const snapshotBase64 = snapshotRow?.snapshot_data
    ? byteaResponseToBase64(snapshotRow.snapshot_data)
    : null
  const cutoffAfter = snapshotRow?.snapshot_cutoff_created_at ?? null

  const PAGE_SIZE = 5000
  const tailRows: Array<{ id: string; update_data: string; created_at: string }> = []
  let offset = 0
  let hasMore = true
  while (hasMore && tailRows.length < COMPACTION_CAP) {
    const limit = Math.min(PAGE_SIZE, COMPACTION_CAP - tailRows.length)
    let tailQuery = supabase
      .from('document_changes')
      .select('id, update_data, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)
    if (cutoffAfter) {
      tailQuery = tailQuery.gt('created_at', cutoffAfter)
    }
    const { data: page, error } = await tailQuery
    if (error) {
      throw new Error(`Failed to fetch tail for compaction: ${error.message}`)
    }
    const rows = (page ?? []) as Array<{ id: string; update_data: string; created_at: string }>
    tailRows.push(...rows)
    hasMore = rows.length === limit
    offset += limit
  }

  if (tailRows.length === 0) {
    return
  }

  const { snapshotData, cutoffCreatedAt } = buildSnapshotFromSnapshotAndTail(
    snapshotBase64,
    tailRows
  )

  const { error: upsertError } = await supabase
    .from('document_snapshots')
    .upsert(
      {
        document_id: documentId,
        snapshot_data: base64ToByteaHex(snapshotData),
        snapshot_cutoff_created_at: cutoffCreatedAt,
      },
      { onConflict: 'document_id' }
    )
  if (upsertError) {
    throw new Error(`Failed to upsert snapshot: ${upsertError.message}`)
  }

  const compactedIds = tailRows.map((r) => r.id)
  const { error: deleteError } = await supabase
    .from('document_changes')
    .delete()
    .in('id', compactedIds)
  if (deleteError) {
    throw new Error(`Failed to delete compacted changes: ${deleteError.message}`)
  }
}
