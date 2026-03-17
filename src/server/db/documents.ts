import { randomUUID } from 'crypto'
import { TRPCError } from '@trpc/server'
import { createClient, throwOnDocumentQueryError, type AuthContext } from './shared'
import { getAuthenticatedUser } from './auth'

type DocumentSchema = {
  id: string
  creator_id: string
  name: string
  last_updated?: Date
}

type DocumentPermissionSchema = {
  id: string
  user_id: string
  document_id: string
  permission: string
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
                last_updated
            )
        `)
    .eq('user_id', userId)
    .order('documents(last_updated)', { ascending: false }) as { data: (DocumentPermissionSchema & { documents: Pick<DocumentSchema, 'name' | 'last_updated'> })[] | null; error: Error | null }

  const documents = data?.map((permission) => ({
    id: permission.document_id,
    name: permission.documents.name
  }))

  if (error) throw new Error(`Failed to fetch documents for user: ${error.message}`)
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

/**
 * Ensures the user has permission to mutate the document (e.g. save changes).
 * If the document does not exist, creates it and an owner permission for the user.
 * If the document exists but the user has no permission, throws FORBIDDEN.
 * Exported for use by document-changes module.
 */
export async function ensureCanMutateDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  userId: string
) {
  const { data: permission, error: permError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .single()

  if (permError && permError.code !== 'PGRST116') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to check document permission',
      cause: permError,
    })
  }

  if (permission) return

  const { data: existingDoc, error: docError } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .single()

  if (docError && docError.code !== 'PGRST116') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to check document existence',
      cause: docError,
    })
  }

  if (existingDoc) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this document',
    })
  }

  await createDocumentWithPermission(supabase, documentId, userId, 'Untitled')
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
    .select('id')
    .eq('id', documentId)
    .single()

  if (docError && docError.code !== 'PGRST116') {
    throw new Error(`Failed to check document: ${docError.message}`)
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
