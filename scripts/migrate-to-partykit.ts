#!/usr/bin/env npx tsx
/**
 * Migration Script: Old CRDT Schema → PartyKit Schema
 * 
 * Migrates documents from the old schema (document_changes + document_snapshots)
 * to the new PartyKit schema (document_state).
 * 
 * Usage:
 *   # Dry run (no changes made)
 *   npm run migrate:partykit -- --dry-run
 * 
 *   # Actual migration
 *   npm run migrate:partykit
 * 
 *   # Migrate specific document
 *   npm run migrate:partykit -- --document-id=<uuid>
 * 
 * Environment variables (loaded from .env.local, .env, or environment):
 *   NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (from Supabase Dashboard → Settings → API)
 * 
 * The service role key bypasses RLS to access all documents.
 * Keep it secret and never commit it to version control.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env files (same order as Next.js)
// .env.local takes precedence over .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 50 // Documents to process per batch
const CHANGES_PAGE_SIZE = 5000 // Max changes to fetch per query

// ============================================================================
// Types
// ============================================================================

type DocumentSnapshotRow = {
  document_id: string
  snapshot_data: string
  snapshot_cutoff_created_at: string
}

type DocumentChangeRow = {
  update_data: string
  created_at: string
}

type MigrationResult = {
  documentId: string
  success: boolean
  error?: string
  hadSnapshot: boolean
  changesCount: number
  stateSize: number
}

// ============================================================================
// Utility Functions (from document-changes.ts)
// ============================================================================

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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = Buffer.from(base64.trim(), 'base64')
  return new Uint8Array(binary)
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function base64ToByteaHex(base64: string): string {
  const buf = Buffer.from(base64, 'base64')
  return '\\x' + buf.toString('hex')
}

// ============================================================================
// Core Migration Logic
// ============================================================================

function reconstructYDocState(
  snapshotBase64: string | null,
  tailRows: DocumentChangeRow[]
): Uint8Array {
  const ydoc = new Y.Doc()
  
  // Apply snapshot if exists
  if (snapshotBase64) {
    const snapshotBytes = base64ToUint8Array(snapshotBase64)
    Y.applyUpdate(ydoc, snapshotBytes)
  }
  
  // Apply all tail changes
  for (const row of tailRows) {
    const updateBytes = base64ToUint8Array(byteaResponseToBase64(row.update_data))
    Y.applyUpdate(ydoc, updateBytes)
  }
  
  // Encode full state
  return Y.encodeStateAsUpdate(ydoc)
}

async function migrateDocument(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = {
    documentId,
    success: false,
    hadSnapshot: false,
    changesCount: 0,
    stateSize: 0,
  }

  try {
    // 1. Check if already migrated
    const { data: existingState } = await supabase
      .from('document_state')
      .select('document_id')
      .eq('document_id', documentId)
      .single()

    if (existingState) {
      result.success = true
      result.error = 'Already migrated (skipped)'
      return result
    }

    // 2. Fetch snapshot (if exists)
    const { data: snapshotRow, error: snapshotError } = await supabase
      .from('document_snapshots')
      .select('snapshot_data, snapshot_cutoff_created_at')
      .eq('document_id', documentId)
      .single()

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch snapshot: ${snapshotError.message}`)
    }

    const snapshot = snapshotRow as DocumentSnapshotRow | null
    const snapshotBase64 = snapshot?.snapshot_data
      ? byteaResponseToBase64(snapshot.snapshot_data)
      : null
    const cutoffAfter = snapshot?.snapshot_cutoff_created_at ?? null

    result.hadSnapshot = !!snapshotBase64

    // 3. Fetch all changes (tail after snapshot cutoff)
    const tailRows: DocumentChangeRow[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('document_changes')
        .select('update_data, created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })
        .range(offset, offset + CHANGES_PAGE_SIZE - 1)

      if (cutoffAfter) {
        query = query.gt('created_at', cutoffAfter)
      }

      const { data: page, error } = await query
      if (error) {
        throw new Error(`Failed to fetch changes: ${error.message}`)
      }

      const rows = (page ?? []) as DocumentChangeRow[]
      tailRows.push(...rows)
      hasMore = rows.length === CHANGES_PAGE_SIZE
      offset += CHANGES_PAGE_SIZE
    }

    result.changesCount = tailRows.length

    // 4. Check if there's any data to migrate
    if (!snapshotBase64 && tailRows.length === 0) {
      result.success = true
      result.error = 'No data to migrate (empty document)'
      return result
    }

    // 5. Reconstruct full Y.Doc state
    const fullState = reconstructYDocState(snapshotBase64, tailRows)
    result.stateSize = fullState.length

    // 6. Insert into document_state (unless dry run)
    if (!dryRun) {
      const { error: insertError } = await supabase
        .from('document_state')
        .insert({
          document_id: documentId,
          state_data: base64ToByteaHex(uint8ArrayToBase64(fullState)),
          updated_at: new Date().toISOString(),
        })

      if (insertError) {
        throw new Error(`Failed to insert state: ${insertError.message}`)
      }
    }

    result.success = true
    return result

  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}

async function getAllDocumentIds(
  supabase: ReturnType<typeof createClient>
): Promise<string[]> {
  const documentIds = new Set<string>()

  // Get documents with snapshots
  const { data: snapshotDocs, error: snapshotError } = await supabase
    .from('document_snapshots')
    .select('document_id')

  if (snapshotError) {
    throw new Error(`Failed to fetch snapshot document IDs: ${snapshotError.message}`)
  }

  for (const row of snapshotDocs ?? []) {
    documentIds.add(row.document_id)
  }

  // Get documents with changes (paginated for large datasets)
  let offset = 0
  let hasMore = true
  const PAGE_SIZE = 1000

  while (hasMore) {
    const { data: changeDocs, error: changeError } = await supabase
      .from('document_changes')
      .select('document_id')
      .range(offset, offset + PAGE_SIZE - 1)

    if (changeError) {
      throw new Error(`Failed to fetch change document IDs: ${changeError.message}`)
    }

    const rows = changeDocs ?? []
    for (const row of rows) {
      documentIds.add(row.document_id)
    }

    hasMore = rows.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  return Array.from(documentIds)
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║       PartyKit Migration: document_changes → document_state    ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()

  // Parse arguments
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const specificDocArg = args.find(a => a.startsWith('--document-id='))
  const specificDocId = specificDocArg?.split('=')[1]

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
    process.exit(1)
  }

  if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    console.error('')
    console.error('   To get your service role key:')
    console.error('   1. Go to your Supabase Dashboard')
    console.error('   2. Navigate to Settings → API')
    console.error('   3. Copy the "service_role" key (NOT the anon key)')
    console.error('')
    console.error('   Then run:')
    console.error('   SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/migrate-to-partykit.ts')
    process.exit(1)
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log(`📡 Connected to: ${supabaseUrl}`)
  console.log()

  // Get document IDs to migrate
  let documentIds: string[]

  if (specificDocId) {
    console.log(`📄 Migrating specific document: ${specificDocId}`)
    documentIds = [specificDocId]
  } else {
    console.log('🔍 Scanning for documents to migrate...')
    documentIds = await getAllDocumentIds(supabase)
    console.log(`   Found ${documentIds.length} documents with old CRDT data`)
  }

  console.log()

  if (documentIds.length === 0) {
    console.log('✅ No documents to migrate!')
    return
  }

  // Process documents in batches
  const results: MigrationResult[] = []
  let processed = 0

  for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
    const batch = documentIds.slice(i, i + BATCH_SIZE)
    
    const batchResults = await Promise.all(
      batch.map(docId => migrateDocument(supabase, docId, dryRun))
    )
    
    results.push(...batchResults)
    processed += batch.length

    // Progress update
    const percent = Math.round((processed / documentIds.length) * 100)
    const succeeded = results.filter(r => r.success && !r.error?.includes('skipped')).length
    const skipped = results.filter(r => r.error?.includes('skipped') || r.error?.includes('empty')).length
    const failed = results.filter(r => !r.success).length
    
    process.stdout.write(
      `\r⏳ Progress: ${processed}/${documentIds.length} (${percent}%) | ` +
      `✅ ${succeeded} migrated | ⏭️ ${skipped} skipped | ❌ ${failed} failed`
    )
  }

  console.log('\n')

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('                         MIGRATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════════')

  const succeeded = results.filter(r => r.success && !r.error?.includes('skipped') && !r.error?.includes('empty'))
  const alreadyMigrated = results.filter(r => r.error?.includes('Already migrated'))
  const emptyDocs = results.filter(r => r.error?.includes('empty document'))
  const failed = results.filter(r => !r.success)

  console.log(`✅ Successfully migrated: ${succeeded.length}`)
  console.log(`⏭️  Already migrated:     ${alreadyMigrated.length}`)
  console.log(`📭 Empty (no data):       ${emptyDocs.length}`)
  console.log(`❌ Failed:                ${failed.length}`)
  console.log()

  if (succeeded.length > 0) {
    const totalSize = succeeded.reduce((sum, r) => sum + r.stateSize, 0)
    const avgSize = Math.round(totalSize / succeeded.length)
    const totalChanges = succeeded.reduce((sum, r) => sum + r.changesCount, 0)
    const withSnapshots = succeeded.filter(r => r.hadSnapshot).length

    console.log('📊 Statistics for migrated documents:')
    console.log(`   • Total state data: ${(totalSize / 1024).toFixed(1)} KB`)
    console.log(`   • Average state size: ${(avgSize / 1024).toFixed(1)} KB`)
    console.log(`   • Total changes processed: ${totalChanges}`)
    console.log(`   • Documents with snapshots: ${withSnapshots}`)
    console.log()
  }

  if (failed.length > 0) {
    console.log('❌ Failed documents:')
    for (const f of failed.slice(0, 10)) {
      console.log(`   • ${f.documentId}: ${f.error}`)
    }
    if (failed.length > 10) {
      console.log(`   ... and ${failed.length - 10} more`)
    }
    console.log()
  }

  if (dryRun) {
    console.log('🔍 This was a DRY RUN. No changes were made.')
    console.log('   Run without --dry-run to perform the actual migration.')
  } else if (failed.length === 0) {
    console.log('🎉 Migration completed successfully!')
  } else {
    console.log('⚠️  Migration completed with errors. Review failed documents above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
