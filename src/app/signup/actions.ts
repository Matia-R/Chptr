"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRandomAvatarColor } from "~/lib/avatar-colors";
import {
  normalizeVerificationCode,
  readableAuthError,
  resendCodeError,
  resendCooldownSeconds,
  verificationCodeError,
} from "~/lib/pending-signup";
import { createClient } from "~/utils/supabase/server";

import {
  clearPendingSignupCookie,
  writePendingSignupCookie,
} from "./pending-signup-cookie";

const emailSchema = z.string().trim().email().max(254);

type SignupResult =
  | { error: string }
  | { verify: true; email: string }
  | { redirectTo: "/onboarding" };

export async function signup(formData: FormData): Promise<SignupResult> {
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (!parsedEmail.success) {
    return { error: "Must be a valid email address" };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: parsedEmail.data,
    password,
    options: {
      data: {
        default_avatar_background_color: getRandomAvatarColor(),
      },
    },
  });

  if (error) {
    return {
      error: readableAuthError(
        error,
        "Couldn't send the verification email. Try again.",
      ),
    };
  }

  revalidatePath("/", "layout");

  if (signUpData.session) {
    await clearPendingSignupCookie();
    return { redirectTo: "/onboarding" };
  }

  await writePendingSignupCookie({
    email: parsedEmail.data,
    stage: "verify",
  });
  return { verify: true, email: parsedEmail.data };
}

export async function verifySignupCode(
  email: string,
  token: string,
): Promise<{ error: string } | { redirectTo: "/onboarding" }> {
  const parsedEmail = emailSchema.safeParse(email);
  const code = normalizeVerificationCode(token);
  if (!parsedEmail.success || code.length !== 6) {
    return { error: "Enter the six-digit code from your email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsedEmail.data,
    token: code,
    type: "email",
  });

  if (error) {
    return { error: verificationCodeError(error.message, error.code) };
  }

  await clearPendingSignupCookie();
  revalidatePath("/", "layout");
  return { redirectTo: "/onboarding" };
}

export async function resendSignupCode(
  email: string,
): Promise<
  { ok: true } | { ok: false; error: string; retryAfterSeconds: number | null }
> {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return {
      ok: false,
      error: "Enter a valid email address.",
      retryAfterSeconds: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsedEmail.data,
  });

  if (error) {
    return {
      ok: false,
      error: resendCodeError(error.message),
      retryAfterSeconds: resendCooldownSeconds(error.message),
    };
  }

  return { ok: true };
}

/** Back to the email form. Keeps the address, drops the verification stage. */
export async function returnToSignupForm(email: string) {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    await clearPendingSignupCookie();
    return;
  }
  await writePendingSignupCookie({
    email: parsedEmail.data,
    stage: "credentials",
  });
}
