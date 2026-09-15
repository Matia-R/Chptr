import {
  isAuthError,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

/** Refresh before the JWT is actually dead so PartyKit connect is not a 401. */
export const ACCESS_TOKEN_TTL_SKEW_MS = 30_000;

const FATAL_REFRESH_CODES = new Set([
  "refresh_token_not_found",
  "invalid_grant",
  "session_not_found",
  "user_banned",
  "user_not_found",
]);

export type LiveAccessTokenResult =
  | { status: "ok"; accessToken: string }
  | { status: "fatal" }
  | { status: "retry" };

/**
 * Best-effort JWT expiry. Not a security check — only used to decide whether
 * to refresh before putting the token on the PartyKit socket.
 */
export function accessTokenNeedsRefresh(
  token: string,
  now = Date.now(),
): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (!payload.exp) return true;
    return now >= payload.exp * 1000 - ACCESS_TOKEN_TTL_SKEW_MS;
  } catch {
    return true;
  }
}

/**
 * True when the refresh token itself is gone or revoked. Transient failures
 * (network, 429, in-flight refresh) must not look like a sign-out.
 */
export function isFatalAuthRefreshError(error: unknown): boolean {
  if (!isAuthError(error)) return false;
  if (error.status === 429) return false;

  const code = error.code ?? "";
  if (
    code === "over_request_rate_limit" ||
    code === "refresh_token_already_used"
  ) {
    return false;
  }
  if (FATAL_REFRESH_CODES.has(code)) return true;

  return (
    (error.status === 400 || error.status === 401) &&
    /refresh.?token|invalid.?grant/i.test(error.message)
  );
}

type AuthSessionClient = Pick<SupabaseClient, "auth">;

function tokenFromSession(session: Session | null): string | null {
  const token = session?.access_token;
  return token ? token : null;
}

/**
 * Return a JWT that is safe to send on the PartyKit socket.
 *
 * Reads the cached session first. Calls `refreshSession` only when the access
 * token is missing or near expiry — never from a TOKEN_REFRESHED handler.
 */
export async function ensureLiveAccessToken(
  supabase: AuthSessionClient,
): Promise<LiveAccessTokenResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (isFatalAuthRefreshError(sessionError)) {
    return { status: "fatal" };
  }

  const cached = tokenFromSession(session);
  if (cached && !accessTokenNeedsRefresh(cached)) {
    return { status: "ok", accessToken: cached };
  }

  const { data, error } = await supabase.auth.refreshSession();
  const refreshed = tokenFromSession(data.session);
  if (refreshed) {
    return { status: "ok", accessToken: refreshed };
  }
  if (isFatalAuthRefreshError(error)) {
    return { status: "fatal" };
  }
  return { status: "retry" };
}
