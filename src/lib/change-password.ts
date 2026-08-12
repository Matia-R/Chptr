import { isAuthError, type AuthError } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/client";

export type ChangePasswordField =
  | "currentPassword"
  | "password"
  | "confirmPassword"
  | "nonce";

export type ChangePasswordResult =
  | { status: "updated" }
  | { status: "reauthentication_required" }
  | {
      status: "error";
      message: string;
      field?: ChangePasswordField;
    };

type ChangePasswordInput = {
  currentPassword: string;
  password: string;
  nonce?: string;
};

function fieldForAuthError(error: AuthError): ChangePasswordField | undefined {
  switch (error.code) {
    case "same_password":
    case "weak_password":
      return "password";
    case "reauthentication_not_valid":
    case "reauth_nonce_missing":
      return "nonce";
    case "invalid_credentials":
      return "currentPassword";
    case "validation_failed":
      return /current.?password|credentials/i.test(error.message)
        ? "currentPassword"
        : undefined;
    default:
      return undefined;
  }
}

function messageForAuthError(error: AuthError): string {
  switch (error.code) {
    case "same_password":
      return "New password must be different from your current password";
    case "weak_password":
      return "Choose a stronger password that hasn't appeared in known data breaches";
    case "reauthentication_not_valid":
    case "reauth_nonce_missing":
      return "That verification code is invalid or expired. Request a new one and try again.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "session_not_found":
      return "Your session expired. Sign in again and retry.";
    case "user_banned":
      return "This account can't change its password right now.";
    case "invalid_credentials":
      return "Current password is incorrect";
    case "validation_failed":
      // Wrong current_password often surfaces as validation_failed.
      if (/current.?password|credentials|invalid/i.test(error.message)) {
        return "Current password is incorrect";
      }
      return error.message || "Couldn't update password";
    default:
      return error.message || "Couldn't update password";
  }
}

/**
 * Updates the signed-in user's password via the browser Supabase client.
 * Passwords never touch our Next.js server or tRPC layer.
 */
export async function changePasswordWithSupabase(
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: input.password,
    current_password: input.currentPassword,
    ...(input.nonce ? { nonce: input.nonce } : {}),
  });

  if (!error) {
    return { status: "updated" };
  }

  if (!isAuthError(error)) {
    return {
      status: "error",
      message: "Couldn't update password",
    };
  }

  if (error.code === "reauthentication_needed") {
    const { error: reauthError } = await supabase.auth.reauthenticate();
    if (reauthError) {
      return {
        status: "error",
        message: isAuthError(reauthError)
          ? messageForAuthError(reauthError)
          : "Couldn't send a verification code. Try again.",
      };
    }
    return { status: "reauthentication_required" };
  }

  return {
    status: "error",
    message: messageForAuthError(error),
    field: fieldForAuthError(error),
  };
}
