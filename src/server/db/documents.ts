import { randomUUID } from 'crypto'
import { TRPCError } from '@trpc/server'
import { revalidatePath } from 'next/cache'
import { createClient, throwOnDocumentQueryError, type AuthContext } from './shared'
import { getAuthenticatedUser } from './auth'
import { notifyPartykitDocumentTrashed } from '~/server/partykit/notify-trashed'

type DocumentSchema = {
  id: string
  creator_id: string
  name: string
  last_updated?: Date
  deleted_at?: string | null
}

type DocumentPermissionSchema = {
  id: string
  user_id: string
  document_id: string
  permission: string
}

type NestedDocument = Pick<DocumentSchema, 'name' | 'last_updated' | 'deleted_at'>

type TrashPublicationPath = {
  owner_username: string
  slug: string
}

type TrashRedirectPath = {
  from_owner_username: string
  from_slug: string
}

type TrashDocumentResult = {
  publication: TrashPublicationPath | null
  redirects: TrashRedirectPath[]
}

function embedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function throwOnLifecycleRpcError(
  error: { code?: string; message?: string },
  action: 'trash' | 'restore'
): never {
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (
    code === 'PT403' ||
    code === '42501' ||
    /not authorized/i.test(message)
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        action === 'trash'
          ? 'You do not have permission to move this document to trash'
          : 'You do not have permission to restore this document',
    })
  }
  if (
    code === 'PT404' ||
    code === 'P0002' ||
    /not found/i.test(message)
  ) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }
  if (code === 'PT401' || /not authenticated/i.test(message)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message:
      message ||
      (action === 'trash'
        ? 'Failed to move document to trash'
        : 'Failed to restore document'),
  })
}

function revalidateTrashedPublicationPaths(result: TrashDocumentResult | null) {
  const publication = result?.publication
  if (publication) {
    revalidatePath(`/${publication.owner_username}/${publication.slug}`)
  }
  for (const row of result?.redirects ?? []) {
    revalidatePath(`/${row.from_owner_username}/${row.from_slug}`)
  }
}

export async function createDocument(auth?: AuthContext) {
  const supabase = auth?.supabase ?? await createClient()
  const currentUserId = auth?.userId ?? (await supabase.auth.getUser()).data.user?.id

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
  const supabase = opts?.supabase ?? (await createClient())

  const { data, error } = await supabase
    .from('documents')
    .select('id, creator_id, name, last_updated')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single() as { data: DocumentSchema | null; error: { code?: string; message?: string } | null }

  if (error) {
    throwOnDocumentQueryError(error, 'Failed to fetch document')
  }
  return { success: true, document: data }
}

export async function getLastUpdatedTimestamp(
  documentId: string,
  opts?: { supabase?: Awaited<ReturnType<typeof createClient>> }
) {
  const supabase = opts?.supabase ?? (await createClient())

  const { data, error } = await supabase
    .from('documents')
    .select('last_updated')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single() as { data: Pick<DocumentSchema, 'last_updated'> | null; error: Error | null }

  if (error) throw new Error(`Failed to fetch last updated timestamp: ${error.message}`)
  return { success: true, lastUpdated: data?.last_updated }
}

export const getDocumentIdsForUser = async (auth?: AuthContext) => {
  let supabase: Awaited<ReturnType<typeof createClient>>
  let userId: string | undefined
  if (auth) {
    supabase = auth.supabase
    userId = auth.userId
  } else {
    supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }
  if (!userId) {
    return { success: true, documents: [] }
  }

  const { data, error } = await supabase
    .from('document_permissions')
    .select(`
            document_id,
            documents:document_id (
                name,
                last_updated,
                deleted_at
            )
        `)
    .eq('user_id', userId)
    .order('documents(last_updated)', { ascending: false }) as {
      data: (DocumentPermissionSchema & { documents: NestedDocument | NestedDocument[] | null })[] | null
      error: Error | null
    }

  const documents = data?.flatMap((permission) => {
    const doc = embedRow(permission.documents)
    if (!doc || doc.deleted_at) return []
    return [{ id: permission.document_id, name: doc.name ?? 'Untitled' }]
  })

  if (error) throw new Error(`Failed to fetch documents for user: ${error.message}`)
  return { success: true, documents }
}

export type TrashedDocumentListItem = {
  id: string
  name: string
  deletedAt: string
}

export const getTrashedDocumentsForUser = async (auth: AuthContext) => {
  const { data, error } = await auth.supabase
    .from('document_permissions')
    .select(`
            document_id,
            documents:document_id (
                name,
                deleted_at
            )
        `)
    .eq('user_id', auth.userId)
    .eq('permission', 'owner') as {
      data: (DocumentPermissionSchema & { documents: NestedDocument | NestedDocument[] | null })[] | null
      error: Error | null
    }

  const documents = data
    ?.flatMap((permission): TrashedDocumentListItem[] => {
      const doc = embedRow(permission.documents)
      if (!doc?.deleted_at) return []
      return [{
        id: permission.document_id,
        name: doc.name ?? 'Untitled',
        deletedAt: doc.deleted_at,
      }]
    })
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt)) ?? []

  if (error) throw new Error(`Failed to fetch trashed documents: ${error.message}`)
  return { success: true, documents }
}

async function createDocumentWithPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  _userId: string,
  name = 'Untitled'
) {
  const { error } = await supabase.rpc('create_document_with_owner', {
    p_document_id: documentId,
    p_name: name,
  })

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`)
  }
}

export async function updateDocumentName(
  documentId: string,
  name: string,
  auth?: AuthContext
) {
  const supabase = auth?.supabase ?? await createClient()
  const user = auth ? { id: auth.userId } : await getAuthenticatedUser(supabase)

  const { data: existingDoc, error: docError } = await supabase
    .from('documents')
    .select('id, deleted_at')
    .eq('id', documentId)
    .maybeSingle()

  if (docError && docError.code !== 'PGRST116') {
    throw new Error(`Failed to check document: ${docError.message}`)
  }

  if (existingDoc?.deleted_at) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Document not found',
    })
  }

  if (!existingDoc) {
    await createDocumentWithPermission(supabase, documentId, user.id, name)
    return { success: true, created: true }
  }

  const { data: permission, error: permCheckError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .single()

  if (permCheckError && permCheckError.code !== 'PGRST116') {
    throw new Error(`Failed to check permission: ${permCheckError.message}`)
  }

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to edit this document',
    })
  }

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      name,
      last_updated: new Date()
    })
    .eq('id', documentId)

  if (updateError) {
    throw new Error(`Failed to update document name: ${updateError.message}`)
  }

  return { success: true, created: false }
}

export async function trashDocument(documentId: string, auth: AuthContext) {
  const { data, error } = await auth.supabase.rpc('trash_document', {
    p_document_id: documentId,
  }) as {
    data: TrashDocumentResult | null
    error: { code?: string; message?: string } | null
  }

  if (error) {
    throwOnLifecycleRpcError(error, 'trash')
  }

  revalidateTrashedPublicationPaths(data)
  await notifyPartykitDocumentTrashed(documentId)

  return { success: true as const }
}

export async function restoreDocument(documentId: string, auth: AuthContext) {
  const { error } = await auth.supabase.rpc('restore_document', {
    p_document_id: documentId,
  }) as { error: { code?: string; message?: string } | null }

  if (error) {
    throwOnLifecycleRpcError(error, 'restore')
  }

  return { success: true as const }
}
