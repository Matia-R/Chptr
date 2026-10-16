"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { friendlyHandleError } from "~/lib/author-handle";
import { signupProfileSchema } from "~/lib/account-schema";
import { getHandleAvailability } from "~/server/db";
import { createClient } from "../../utils/supabase/server";
import { getRandomAvatarColor } from "../../lib/avatar-colors";

/** No account yet, so availability cannot match "your" handle. */
const ANONYMOUS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

/** Postgres / PostgREST messages when a handle claim is rejected. */
function isHandleClaimError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("profiles_username_lower_unique") ||
    normalized.includes("profiles_username") ||
    normalized.includes("that username is") ||
    normalized.includes("invalid handle") ||
    (normalized.includes("duplicate key") && normalized.includes("username")) ||
    (normalized.includes("unique constraint") &&
      normalized.includes("username")) ||
    (normalized.includes("violates unique constraint") &&
      normalized.includes("username"))
  );
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const authorName = ((formData.get("authorName") as string) ?? "").trim();
  const username = ((formData.get("username") as string) ?? "").trim();
  const parsed = signupProfileSchema.safeParse({
    author_name: authorName,
    username,
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check your author name and handle.",
    };
  }

  let availability: Awaited<ReturnType<typeof getHandleAvailability>>;
  try {
    availability = await getHandleAvailability(
      { supabase, userId: ANONYMOUS_PROFILE_ID },
      parsed.data.username,
    );
  } catch {
    return { error: "Could not check that handle. Try again." };
  }
  if (availability !== "available") {
    return {
      error:
        availability === "reserved"
          ? "That handle is reserved."
          : availability === "invalid"
            ? "Use 2–50 letters, numbers, hyphens, or underscores."
            : "That handle is already taken.",
    };
  }

  const userMeta: Record<string, string> = {
    default_avatar_background_color: getRandomAvatarColor(),
    author_name: parsed.data.author_name,
    username: parsed.data.username,
  };

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: userMeta,
    },
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  if (error) {
    const authErr = error.message ?? "";
    if (isHandleClaimError(authErr)) {
      return { error: friendlyHandleError(authErr) };
    }
    return { error: authErr || "Sign up failed" };
  }

  if (signUpData.user && signUpData.session) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: signUpData.user.id,
      author_name: parsed.data.author_name || null,
      username: parsed.data.username || null,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      const pe = profileError.message ?? "";
      if (
        isHandleClaimError(pe) ||
        profileError.code === "23505" ||
        profileError.code === "23514"
      ) {
        return { error: friendlyHandleError(pe) };
      }
      console.log(profileError);
      return { error: pe || "Could not update profile" };
    }
  }

  revalidatePath("/", "layout");
  redirect("/confirm-signup");
}
