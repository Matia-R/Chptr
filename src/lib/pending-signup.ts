import { z } from "zod";

/** How long a refresh can restore the in-progress signup email. */
export const PENDING_SIGNUP_MAX_AGE_SECONDS = 30 * 60;

const emailSchema = z.string().trim().email().max(254);

export type PendingSignupStage = "credentials" | "verify";

export type PendingSignup = {
  email: string;
  stage: PendingSignupStage;
};

export function serializePendingSignup(pending: PendingSignup): string {
  return `${pending.stage}:${encodeURIComponent(pending.email)}`;
}

/** Email only. A bad or expired value is treated as no pending signup. */
export function parsePendingSignup(
  value: string | undefined | null,
): PendingSignup | null {
  if (!value) return null;
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return null;

  const stage = value.slice(0, splitAt);
  if (stage !== "credentials" && stage !== "verify") return null;

  let email = "";
  try {
    email = decodeURIComponent(value.slice(splitAt + 1));
  } catch {
    return null;
  }

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return null;
  return { email: parsed.data, stage };
}

export function normalizeVerificationCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/** Supabase sometimes returns an empty object when email delivery fails. */
export function readableAuthError(
  error: { message?: string; code?: string | null },
  fallback: string,
): string {
  const message = typeof error.message === "string" ? error.message.trim() : "";
  if (!message || message === "{}") return fallback;
  return message;
}

export function verificationCodeError(message: string, code?: string): string {
  const lower = message.toLowerCase();
  if (code === "over_request_rate_limit" || lower.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (
    code === "otp_expired" ||
    (lower.includes("expired") && !lower.includes("invalid"))
  ) {
    return "That code has expired. Request a new one.";
  }
  if (
    code === "otp_disabled" ||
    lower.includes("invalid") ||
    lower.includes("token") ||
    lower.includes("otp")
  ) {
    return "That code is incorrect or has expired.";
  }
  return "Couldn't verify that code. Try again.";
}

export type ResendCodeResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds: number | null };

/** Seconds from a Supabase rate-limit message, when it includes them. */
export function resendCooldownSeconds(message: string): number | null {
  const match = /(\d+)\s*seconds?/i.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.ceil(seconds), 10 * 60);
}

export function resendCodeError(message: string): string {
  const seconds = resendCooldownSeconds(message);
  if (seconds) {
    return `You can request a new code in ${seconds} seconds.`;
  }
  if (message.toLowerCase().includes("rate")) {
    return "Too many emails were sent. Wait a moment and try again.";
  }
  return "Couldn't send a new code. Try again.";
}
