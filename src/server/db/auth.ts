import { TRPCError } from '@trpc/server'
import { createClient, type AuthContext } from './shared'

type UserProfile = {
  updated_at: string
  avatar_url: string
  first_name: string | null
  last_name: string | null
  default_avatar_background_color: string
  username: string | null
}

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
