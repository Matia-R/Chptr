import { TRPCError } from '@trpc/server'
import { revalidatePath } from 'next/cache'

import {
  isValidOwnerPathSegment,
  isValidPublicationSlug,
  normalizePublicationUsername,
  publicationOwnerPathSegment,
  slugifyTitle,
} from '~/lib/slug'
import { sanitizePublishedHtml } from '~/lib/published-html'

import type { AuthContext } from './shared'

export type DocumentPublicationRow = {
  document_id: string
  creator_id: string
  owner_username: string
  slug: string
  title: string
  body_html: string
  blocks_json: unknown
  published_at: string
  updated_at: string
}

type DocRow = {
  id: string
  creator_id: string
  name: string | null
}

type ProfileNameRow = {
  username: string | null
  first_name: string | null
  last_name: string | null
}

type PublicationIdRow = {
  document_id: string
}

type PriorPublicationRow = {
  published_at: string
  owner_username: string
  slug: string
}

type PublicationSlugRow = {
  owner_username: string
  slug: string
}

async function allocateSlug(
  supabase: AuthContext['supabase'],
  ownerUsername: string,
  baseSlug: string,
  documentId: string
): Promise<string> {
  if (!isValidPublicationSlug(baseSlug)) {
    baseSlug = 'untitled'
  }

  for (let i = 0; i < 64; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`
    if (!isValidPublicationSlug(candidate)) continue

    const { data: slugRowRaw, error: slugLookupError } = await supabase
      .from('document_publications')
      .select('document_id')
      .eq('owner_username', ownerUsername)
      .eq('slug', candidate)
      .maybeSingle()

    if (slugLookupError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Slug check failed: ${slugLookupError.message}`,
      })
    }

    const data = slugRowRaw as PublicationIdRow | null

    if (!data || data.document_id === documentId) {
      return candidate
    }
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Could not allocate a unique slug; try a different title.',
  })
}

export async function getPublicationByUsernameSlug(
  ownerUsername: string,
  slug: string,
  supabase: AuthContext['supabase']
): Promise<DocumentPublicationRow | null> {
  const u = normalizePublicationUsername(ownerUsername)
  const s = slug.trim().toLowerCase()
  if (!isValidPublicationSlug(s)) return null

  const pubResult = await supabase
    .from('document_publications')
    .select('*')
    .eq('owner_username', u)
    .eq('slug', s)
    .maybeSingle()

  if (pubResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: pubResult.error.message,
    })
  }

  return pubResult.data as DocumentPublicationRow | null
}

export async function getPublicationByDocumentId(
  documentId: string,
  auth: AuthContext
): Promise<DocumentPublicationRow | null> {
  const { supabase, userId } = auth

  const { data: permission, error: permError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (permError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: permError.message,
    })
  }

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to view this document',
    })
  }

  const pubByDoc = await supabase
    .from('document_publications')
    .select('*')
    .eq('document_id', documentId)
    .maybeSingle()

  if (pubByDoc.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: pubByDoc.error.message,
    })
  }

  return pubByDoc.data as DocumentPublicationRow | null
}

/**
 * Resolved first path segment for a document's public URL (`/[segment]/[title-slug]`),
 * from the document **owner's** profile (username if set and valid, else first+last).
 * Editors with permission only.
 */
export async function getPublicationOwnerPathSegmentForDocument(
  documentId: string,
  auth: AuthContext
): Promise<{ ownerSegment: string | null }> {
  const { supabase, userId } = auth

  const { data: permission, error: permError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (permError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: permError.message,
    })
  }

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to view this document',
    })
  }

  const docResult = await supabase
    .from('documents')
    .select('creator_id')
    .eq('id', documentId)
    .maybeSingle()

  if (docResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: docResult.error.message,
    })
  }
  const doc = docResult.data as { creator_id: string } | null
  if (!doc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }

  const profileResult = await supabase
    .from('profiles')
    .select('username, first_name, last_name')
    .eq('id', doc.creator_id)
    .maybeSingle()

  if (profileResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: profileResult.error.message,
    })
  }

  const profile = profileResult.data as ProfileNameRow | null
  const segment = publicationOwnerPathSegment({
    username: profile?.username,
    first_name: profile?.first_name,
    last_name: profile?.last_name,
  })

  return {
    ownerSegment: isValidOwnerPathSegment(segment) ? segment : null,
  }
}

export async function publishDocument(
  input: {
    documentId: string
    slug?: string
    title: string
    bodyHtml: string
    blocksJson: string
  },
  auth: AuthContext
) {
  const { supabase, userId } = auth

  const { data: permission, error: permError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', input.documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (permError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: permError.message,
    })
  }

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to publish this document',
    })
  }

  const docResult = await supabase
    .from('documents')
    .select('id, creator_id, name')
    .eq('id', input.documentId)
    .single()

  if (docResult.error) {
    if (docResult.error.code === 'PGRST116') {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: docResult.error.message,
    })
  }
  const doc = docResult.data as DocRow | null
  if (!doc) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
  }

  const profileResult = await supabase
    .from('profiles')
    .select('username, first_name, last_name')
    .eq('id', doc.creator_id)
    .maybeSingle()

  if (profileResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: profileResult.error.message,
    })
  }

  const profile = profileResult.data as ProfileNameRow | null
  const ownerUsername = publicationOwnerPathSegment({
    username: profile?.username,
    first_name: profile?.first_name,
    last_name: profile?.last_name,
  })

  if (!isValidOwnerPathSegment(ownerUsername)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'The document owner needs a username, or first and last names that produce a valid public URL (2–50 URL-safe characters). Update profile in Account settings.',
    })
  }

  let blocksParsed: unknown
  try {
    blocksParsed = JSON.parse(input.blocksJson) as unknown
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid blocks payload',
    })
  }

  if (!Array.isArray(blocksParsed)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Blocks payload must be a JSON array',
    })
  }

  const titleInput = input.title.trim()
  const title =
    titleInput.length > 0 ? titleInput : doc.name?.trim() ?? 'Untitled'
  const slugInput = input.slug?.trim()
  const baseSlug = slugInput ? slugifyTitle(slugInput) : slugifyTitle(title)

  const finalSlug = await allocateSlug(
    supabase,
    ownerUsername,
    baseSlug,
    input.documentId
  )

  const bodyHtml = sanitizePublishedHtml(input.bodyHtml)
  if (!bodyHtml.trim()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Nothing to publish (empty content).',
    })
  }

  const priorResult = await supabase
    .from('document_publications')
    .select('published_at, owner_username, slug')
    .eq('document_id', input.documentId)
    .maybeSingle()

  const priorPub = priorResult.data as PriorPublicationRow | null

  const publishedAt = priorPub?.published_at ?? new Date().toISOString()

  const row = {
    document_id: input.documentId,
    creator_id: doc.creator_id,
    owner_username: ownerUsername,
    slug: finalSlug,
    title,
    body_html: bodyHtml,
    blocks_json: blocksParsed,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  }

  const upsertResult = await supabase
    .from('document_publications')
    .upsert(row, { onConflict: 'document_id' })
    .select()
    .single()

  if (upsertResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: upsertResult.error.message,
    })
  }

  const upserted = upsertResult.data as DocumentPublicationRow

  if (
    priorPub &&
    (priorPub.slug !== finalSlug || priorPub.owner_username !== ownerUsername)
  ) {
    revalidatePath(`/${priorPub.owner_username}/${priorPub.slug}`)
  }

  const path = `/${ownerUsername}/${finalSlug}`
  revalidatePath(path)

  return {
    success: true as const,
    publication: upserted,
    publicPath: path,
  }
}

export async function unpublishDocument(documentId: string, auth: AuthContext) {
  const { supabase, userId } = auth

  const { data: permission, error: permError } = await supabase
    .from('document_permissions')
    .select('id')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  if (permError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: permError.message,
    })
  }

  if (!permission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to unpublish this document',
    })
  }

  const existingResult = await supabase
    .from('document_publications')
    .select('owner_username, slug')
    .eq('document_id', documentId)
    .maybeSingle()

  const existing = existingResult.data as PublicationSlugRow | null

  const { error: delError } = await supabase
    .from('document_publications')
    .delete()
    .eq('document_id', documentId)

  if (delError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: delError.message,
    })
  }

  if (existing) {
    revalidatePath(`/${existing.owner_username}/${existing.slug}`)
  }

  return { success: true as const }
}
