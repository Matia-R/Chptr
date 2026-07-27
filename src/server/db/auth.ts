import { TRPCError } from '@trpc/server'
import { AVATAR_BUCKET } from '~/lib/avatar-schema'
import { createClient, type AuthContext } from './shared'

export type UserProfile = {
  updated_at: string
  avatar_url: string | null
  first_name: string | null
  last_name: string | null
  default_avatar_background_color: string
  username: string | null
}

export type UpdateUserProfileInput = {
  first_name: string | null
  last_name: string | null
  username: string | null
}

/** Postgres unique-violation, raised by the case-insensitive username index. */
const UNIQUE_VIOLATION = '23505'

/**
 * Returns the current authenticated user. Throws UNAUTHORIZED if not logged in.
 * Exported for use by documents and document-changes modules.
 */
export async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    })
  }
  return user
}

export async function getCurrentUser(auth?: AuthContext): Promise<string | undefined> {
  const supabase = auth?.supabase ?? await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Not authenticated')
  return user.email
}

export async function getCurrentUserProfile(auth?: AuthContext): Promise<UserProfile | undefined> {
  const supabase = auth?.supabase ?? await createClient()
  const userId = auth?.userId ?? (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single<UserProfile>()
  if (error) throw new Error('Failed to fetch user profile')
  return data
}

export async function updateUserProfile(
  auth: AuthContext,
  input: UpdateUserProfileInput
): Promise<UserProfile> {
  const { data, error } = await auth.supabase
    .from('profiles')
    .upsert({
      id: auth.userId,
      first_name: input.first_name,
      last_name: input.last_name,
      username: input.username,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single<UserProfile>()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'That username is already taken.',
      })
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update profile',
    })
  }

  return data
}

/**
 * Deletes every object in the user's avatar folder except `keepPath`. Orphaned
 * files are harmless, so a failure here must not fail the profile update.
 */
async function pruneOldAvatars(auth: AuthContext, keepPath: string | null) {
  const { data: existing } = await auth.supabase.storage
    .from(AVATAR_BUCKET)
    .list(auth.userId)

  const stale = (existing ?? [])
    .map((object) => `${auth.userId}/${object.name}`)
    .filter((path) => path !== keepPath)

  if (stale.length > 0) {
    await auth.supabase.storage.from(AVATAR_BUCKET).remove(stale)
  }
}

/**
 * Points the profile at an already-uploaded avatar, or clears it when `path` is
 * null. Takes a storage path rather than a URL so the public URL is derived
 * here and a caller cannot point the profile at an arbitrary address.
 */
export async function updateUserAvatar(
  auth: AuthContext,
  path: string | null
): Promise<UserProfile> {
  if (path !== null && !path.startsWith(`${auth.userId}/`)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'That avatar does not belong to you.',
    })
  }

  const avatarUrl =
    path === null
      ? null
      : auth.supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data
          .publicUrl

  const { data, error } = await auth.supabase
    .from('profiles')
    .upsert({
      id: auth.userId,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single<UserProfile>()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update avatar',
    })
  }

  await pruneOldAvatars(auth, path)

  return data
}

export async function updateUserPassword(
  auth: AuthContext,
  password: string
): Promise<void> {
  const { error } = await auth.supabase.auth.updateUser({ password })

  if (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    })
  }
}
