import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";

function requireSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Supabase client that runs as the user who owns `accessToken`.
 * Uses `accessToken` so PostgREST gets that JWT (and `auth.uid()`) on every
 * query — setting `global.headers.Authorization` alone can be overwritten
 * with the anon key when there is no persisted session.
 *
 * Do not call `supabase.auth.*` on this client. Validate tokens with
 * `getUserFromAccessToken` first.
 */
export function createClientFromToken(accessToken: string) {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/** Validate a user JWT with Supabase Auth and return a client scoped to it. */
export async function getUserFromAccessToken(accessToken: string): Promise<{
  supabase: ReturnType<typeof createClientFromToken>;
  user: User | null;
}> {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseEnv();

  // A client configured with `accessToken` cannot use supabase.auth.*.
  const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await authClient.auth.getUser(accessToken);
  const supabase = createClientFromToken(accessToken);

  if (error || !data.user) {
    return { supabase, user: null };
  }

  return { supabase, user: data.user };
}
