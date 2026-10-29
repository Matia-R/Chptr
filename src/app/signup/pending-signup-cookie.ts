import "server-only";

import { cookies } from "next/headers";

import {
  PENDING_SIGNUP_MAX_AGE_SECONDS,
  parsePendingSignup,
  serializePendingSignup,
  type PendingSignup,
} from "~/lib/pending-signup";

const PENDING_SIGNUP_COOKIE = "chptr_pending_signup";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function readPendingSignupCookie(): Promise<PendingSignup | null> {
  const store = await cookies();
  return parsePendingSignup(store.get(PENDING_SIGNUP_COOKIE)?.value);
}

export async function writePendingSignupCookie(pending: PendingSignup) {
  const store = await cookies();
  store.set(
    PENDING_SIGNUP_COOKIE,
    serializePendingSignup(pending),
    cookieOptions(PENDING_SIGNUP_MAX_AGE_SECONDS),
  );
}

export async function clearPendingSignupCookie() {
  const store = await cookies();
  store.set(PENDING_SIGNUP_COOKIE, "", cookieOptions(0));
}
