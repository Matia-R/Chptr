import { TRPCError } from '@trpc/server'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'

import { createClient } from '~/utils/supabase/server'

import {
  isValidOwnerPathSegment,
  isValidPublicationSlug,
  normalizePublicationUsername,
  publicationOwnerPathSegment,
  slugifyTitle,
} from '~/lib/slug'

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

/** Fields needed for public published-page author row (from `profiles`). */
export type PublishedAuthorProfileRow = {
  username: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  default_avatar_background_color: string | null
}

export function authorDisplayLabel(
  profile: PublishedAuthorProfileRow | null,
  ownerUsername: string
): string {
  if (!profile) return ownerUsername
  const parts = [profile.first_name, profile.last_name]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0))
  if (parts.length > 0) return parts.join(' ')
  const u = profile.username?.trim()
  if (u) return u
  return ownerUsername
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

type PublicationSlugWithDocumentRow = PublicationSlugRow & {
  document_id: string
}

type PublicationRedirectTargetRow = {
  to_owner_username: string
  to_slug: string
}

type PublicationRedirectFromRow = {
  from_owner_username: string
  from_slug: string
}

/**
 * Records a path-exact redirect and collapses any existing redirects that
 * pointed at the old path so old URLs resolve in one hop to the latest path.
 */
async function recordPublicationPathRedirect(
  supabase: AuthContext['supabase'],
  input: {
    fromOwnerUsername: string
    fromSlug: string
    toOwnerUsername: string
    toSlug: string
    documentId: string
    creatorId: string
  }
): Promise<void> {
  const fromU = normalizePublicationUsername(input.fromOwnerUsername)
  const toU = normalizePublicationUsername(input.toOwnerUsername)
  const fromS = input.fromSlug.trim().toLowerCase()
  const toS = input.toSlug.trim().toLowerCase()

  if (fromU === toU && fromS === toS) return
  if (!isValidOwnerPathSegment(fromU) || !isValidOwnerPathSegment(toU)) return
  if (!isValidPublicationSlug(fromS) || !isValidPublicationSlug(toS)) return

  const now = new Date().toISOString()

  // Would-be identity after collapse: delete instead of updating.
  const { error: identityDeleteError } = await supabase
    .from('document_publication_redirects')
    .delete()
    .eq('to_owner_username', fromU)
    .eq('to_slug', fromS)
    .eq('from_owner_username', toU)
    .eq('from_slug', toS)

  if (identityDeleteError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: identityDeleteError.message,
    })
  }

  const { error: collapseError } = await supabase
    .from('document_publication_redirects')
    .update({
      to_owner_username: toU,
      to_slug: toS,
      updated_at: now,
    })
    .eq('to_owner_username', fromU)
    .eq('to_slug', fromS)

  if (collapseError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: collapseError.message,
    })
  }

  // Destination path must not redirect away (avoids loops).
  const { error: destDeleteError } = await supabase
    .from('document_publication_redirects')
    .delete()
    .eq('from_owner_username', toU)
    .eq('from_slug', toS)

  if (destDeleteError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: destDeleteError.message,
    })
  }

  const { error: upsertError } = await supabase
    .from('document_publication_redirects')
    .upsert(
      {
        from_owner_username: fromU,
        from_slug: fromS,
        to_owner_username: toU,
        to_slug: toS,
        document_id: input.documentId,
        creator_id: input.creatorId,
        updated_at: now,
      },
      { onConflict: 'from_owner_username,from_slug' }
    )

  if (upsertError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: upsertError.message,
    })
  }
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
    if (data && data.document_id !== documentId) {
      continue
    }

    // Redirect targets reserve old paths so another doc can't claim them.
    const { data: redirectRowRaw, error: redirectLookupError } = await supabase
      .from('document_publication_redirects')
      .select('document_id')
      .eq('from_owner_username', ownerUsername)
      .eq('from_slug', candidate)
      .maybeSingle()

    if (redirectLookupError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Slug redirect check failed: ${redirectLookupError.message}`,
      })
    }

    const redirectRow = redirectRowRaw as PublicationIdRow | null
    if (redirectRow && redirectRow.document_id !== documentId) {
      continue
    }

    return candidate
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Could not allocate a unique slug; try a different title.',
  })
}

/**
 * Path-exact publication redirect. Checked before live publication lookup so
 * vacated usernames keep resolving even if another user later claims the path.
 */
export async function getPublicationRedirectByUsernameSlug(
  ownerUsername: string,
  slug: string,
  supabase: AuthContext['supabase']
): Promise<{ toOwnerUsername: string; toSlug: string } | null> {
  const u = normalizePublicationUsername(ownerUsername)
  const s = slug.trim().toLowerCase()
  if (!isValidOwnerPathSegment(u) || !isValidPublicationSlug(s)) return null

  const redirectResult = await supabase
    .from('document_publication_redirects')
    .select('to_owner_username, to_slug')
    .eq('from_owner_username', u)
    .eq('from_slug', s)
    .maybeSingle()

  if (redirectResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: redirectResult.error.message,
    })
  }

  const row = redirectResult.data as PublicationRedirectTargetRow | null
  if (!row) return null

  return {
    toOwnerUsername: row.to_owner_username,
    toSlug: row.to_slug,
  }
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

/**
 * Publication row plus creator profile for public `/[username]/[slug]`.
 * Wrapped in `cache()` so `generateMetadata` and the page share one DB round-trip per request.
 * Uses only `(username, slug)` as the cache key (not the Supabase client instance).
 */
export const getPublicationWithAuthorByUsernameSlug = cache(
  async (
    ownerUsername: string,
    slug: string
  ): Promise<{
    publication: DocumentPublicationRow
    authorProfile: PublishedAuthorProfileRow | null
  } | null> => {
    const supabase = await createClient()
    const publication = await getPublicationByUsernameSlug(
      ownerUsername,
      slug,
      supabase
    )
    if (!publication) return null

    const profileResult = await supabase
      .from('profiles')
      .select(
        'username, first_name, last_name, avatar_url, default_avatar_background_color'
      )
      .eq('id', publication.creator_id)
      .maybeSingle()

    if (profileResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: profileResult.error.message,
      })
    }

    return {
      publication,
      authorProfile: profileResult.data as PublishedAuthorProfileRow | null,
    }
  }
)

/**
 * Cached redirect lookup for public `/[username]/[slug]` (shared by page + metadata).
 */
export const getCachedPublicationRedirectByUsernameSlug = cache(
  async (
    ownerUsername: string,
    slug: string
  ): Promise<{ toOwnerUsername: string; toSlug: string } | null> => {
    const supabase = await createClient()
    return getPublicationRedirectByUsernameSlug(ownerUsername, slug, supabase)
  }
)

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

  const { sanitizePublishedHtml } = await import('~/lib/published-html')
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

  if (priorResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: priorResult.error.message,
    })
  }

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
    await recordPublicationPathRedirect(supabase, {
      fromOwnerUsername: priorPub.owner_username,
      fromSlug: priorPub.slug,
      toOwnerUsername: ownerUsername,
      toSlug: finalSlug,
      documentId: input.documentId,
      creatorId: doc.creator_id,
    })
    revalidatePath(`/${priorPub.owner_username}/${priorPub.slug}`)
  }

  // Live publication path must not also be a redirect source.
  const { error: liveRedirectDeleteError } = await supabase
    .from('document_publication_redirects')
    .delete()
    .eq('from_owner_username', ownerUsername)
    .eq('from_slug', finalSlug)

  if (liveRedirectDeleteError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: liveRedirectDeleteError.message,
    })
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

  const redirectsResult = await supabase
    .from('document_publication_redirects')
    .select('from_owner_username, from_slug')
    .eq('document_id', documentId)

  if (redirectsResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: redirectsResult.error.message,
    })
  }

  const redirects = (redirectsResult.data ?? []) as PublicationRedirectFromRow[]

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

  const { error: redirectDelError } = await supabase
    .from('document_publication_redirects')
    .delete()
    .eq('document_id', documentId)

  if (redirectDelError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: redirectDelError.message,
    })
  }

  if (existing) {
    revalidatePath(`/${existing.owner_username}/${existing.slug}`)
  }
  for (const row of redirects) {
    revalidatePath(`/${row.from_owner_username}/${row.from_slug}`)
  }

  return { success: true as const }
}

/**
 * Rewrites `document_publications.owner_username` for every publication owned by
 * this user so public URLs track the current profile path segment (username or
 * name fallback). Writes path-exact redirects from old URLs and collapses
 * redirect chains. Called after profile updates that change that segment.
 */
export async function syncPublicationOwnerUsernameForCreator(
  auth: AuthContext,
  nextOwnerUsername: string
): Promise<void> {
  if (!isValidOwnerPathSegment(nextOwnerUsername)) {
    return
  }

  const { supabase, userId } = auth

  const existingResult = await supabase
    .from('document_publications')
    .select('document_id, owner_username, slug')
    .eq('creator_id', userId)

  if (existingResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: existingResult.error.message,
    })
  }

  const existing = (existingResult.data ?? []) as PublicationSlugWithDocumentRow[]
  const stale = existing.filter(
    (row) => row.owner_username !== nextOwnerUsername
  )
  if (stale.length === 0) {
    return
  }

  for (const row of stale) {
    const { data: blockingRedirectRaw, error: blockingRedirectError } =
      await supabase
        .from('document_publication_redirects')
        .select('document_id')
        .eq('from_owner_username', nextOwnerUsername)
        .eq('from_slug', row.slug)
        .maybeSingle()

    if (blockingRedirectError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: blockingRedirectError.message,
      })
    }

    const blockingRedirect = blockingRedirectRaw as PublicationIdRow | null
    if (
      blockingRedirect &&
      blockingRedirect.document_id !== row.document_id
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'That username conflicts with a reserved published URL. Unpublish or rename the conflicting document, then try again.',
      })
    }
  }

  const { error: updateError } = await supabase
    .from('document_publications')
    .update({
      owner_username: nextOwnerUsername,
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', userId)
    .neq('owner_username', nextOwnerUsername)

  if (updateError) {
    if (updateError.code === '23505') {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'That username conflicts with an existing published URL. Unpublish or rename the conflicting document, then try again.',
      })
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: updateError.message,
    })
  }

  for (const row of stale) {
    await recordPublicationPathRedirect(supabase, {
      fromOwnerUsername: row.owner_username,
      fromSlug: row.slug,
      toOwnerUsername: nextOwnerUsername,
      toSlug: row.slug,
      documentId: row.document_id,
      creatorId: userId,
    })
    revalidatePath(`/${row.owner_username}/${row.slug}`)
    revalidatePath(`/${nextOwnerUsername}/${row.slug}`)
  }
}

