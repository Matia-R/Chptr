import { TRPCError } from "@trpc/server";
import {
  enumerateHandleCandidates,
  friendlyHandleError,
  type HandleAvailability,
} from "~/lib/author-handle";
import { AVATAR_BUCKET } from "~/lib/avatar-schema";
import {
  assertCompletedProfileUpdate,
  isOnboardingComplete,
  suggestedAvatarUrlFromAuthMetadata,
} from "~/lib/onboarding";
import {
  isValidOwnerPathSegment,
  publicationOwnerPathSegment,
} from "~/lib/slug";
import { syncPublicationOwnerUsernameForCreator } from "./document-publications";
import { createClient, type AuthContext } from "./shared";

export type UserProfile = {
  updated_at: string;
  avatar_url: string | null;
  author_name: string | null;
  /** Legacy columns kept until every environment has backfilled `author_name`. */
  first_name: string | null;
  last_name: string | null;
  default_avatar_background_color: string;
  username: string | null;
  /** Set only by `complete_author_onboarding`. Null until identity is confirmed. */
  onboarding_completed_at: string | null;
};

export type UpdateUserProfileInput = {
  author_name: string | null;
  username: string | null;
};

/** Postgres unique-violation, raised by the case-insensitive username index. */
const UNIQUE_VIOLATION = "23505";

/**
 * Returns the current authenticated user. Throws UNAUTHORIZED if not logged in.
 * Exported for use by documents and related modules.
 */
export async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return user;
}

export async function getCurrentUser(
  auth?: AuthContext,
): Promise<string | undefined> {
  const supabase = auth?.supabase ?? (await createClient());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");
  return user.email;
}

export async function getCurrentUserProfile(
  auth?: AuthContext,
): Promise<UserProfile | undefined> {
  const supabase = auth?.supabase ?? (await createClient());
  const userId = auth?.userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<UserProfile>();
  if (error) throw new Error("Failed to fetch user profile");
  return data;
}

export async function updateUserProfile(
  auth: AuthContext,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const current = await getCurrentUserProfile(auth);
  const preserved = assertCompletedProfileUpdate(current, input);
  if (!preserved.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: preserved.message,
    });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert({
      id: auth.userId,
      author_name: input.author_name,
      username: input.username,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single<UserProfile>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION || error.code === "23514") {
      throw new TRPCError({
        code: error.code === UNIQUE_VIOLATION ? "CONFLICT" : "BAD_REQUEST",
        message: friendlyHandleError(error.message),
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update profile",
    });
  }

  const nextSegment = publicationOwnerPathSegment({
    username: data.username,
  });

  // Sync whenever the next handle is valid, not only when it just changed.
  // A failed redirect write can then be retried by saving the profile again.
  // The sync itself does nothing when every publication already uses this handle.
  if (isValidOwnerPathSegment(nextSegment)) {
    await syncPublicationOwnerUsernameForCreator(auth, nextSegment);
  }

  return data;
}

export type OnboardingProgressInput = {
  author_name?: string;
  username?: string;
};

/**
 * Persists a confirmed name or handle without marking onboarding complete.
 * Omitted fields are left as they are.
 */
export async function saveOnboardingProgress(
  auth: AuthContext,
  input: OnboardingProgressInput,
): Promise<UserProfile> {
  const current = await getCurrentUserProfile(auth);
  if (isOnboardingComplete(current)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Onboarding is already complete.",
    });
  }

  const patch: {
    author_name?: string;
    username?: string;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };
  if (input.author_name !== undefined) patch.author_name = input.author_name;
  if (input.username !== undefined) patch.username = input.username;

  const { data, error } = await auth.supabase
    .from("profiles")
    .update(patch)
    .eq("id", auth.userId)
    .select("*")
    .single<UserProfile>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION || error.code === "23514") {
      throw new TRPCError({
        code: error.code === UNIQUE_VIOLATION ? "CONFLICT" : "BAD_REQUEST",
        message: friendlyHandleError(error.message),
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save onboarding progress",
    });
  }

  return data;
}

/**
 * Atomically stores the confirmed identity and the completion timestamp.
 * A profile that is already complete is left unchanged.
 */
export async function completeOnboarding(
  auth: AuthContext,
  input: { author_name: string; username: string },
): Promise<UserProfile> {
  const { error } = await auth.supabase.rpc("complete_author_onboarding", {
    p_author_name: input.author_name,
    p_username: input.username,
  });

  if (error) {
    const message = error.message ?? "";
    if (/already complete/i.test(message)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Onboarding is already complete.",
      });
    }
    if (error.code === "42501" || /not authenticated/i.test(message)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }
    if (/author name is required/i.test(message)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Author name is required.",
      });
    }
    if (/handle is required/i.test(message)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A handle is required.",
      });
    }
    if (
      error.code === UNIQUE_VIOLATION ||
      error.code === "23514" ||
      error.code === "23505" ||
      /author name|handle|username|reserved|invalid/i.test(message)
    ) {
      throw new TRPCError({
        code:
          error.code === UNIQUE_VIOLATION || error.code === "23505"
            ? "CONFLICT"
            : "BAD_REQUEST",
        message: friendlyHandleError(message),
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to finish onboarding",
    });
  }

  const profile = await getCurrentUserProfile(auth);
  if (!profile || !isOnboardingComplete(profile)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to finish onboarding",
    });
  }
  return profile;
}

/**
 * Copies the signed-in user's provider photo onto the profile. The URL is
 * taken from provider identity data, or from metadata only when it is an
 * https URL on a known provider host. Anything else is rejected before the
 * profile is updated.
 */
export async function acceptSuggestedAvatar(
  auth: AuthContext,
  metadata: unknown,
): Promise<UserProfile> {
  const avatarUrl = suggestedAvatarUrlFromAuthMetadata(metadata);
  if (!avatarUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "There is no photo to use.",
    });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.userId)
    .select("*")
    .single<UserProfile>();

  if (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update avatar",
    });
  }

  return data;
}

/**
 * Deletes every object in the user's avatar folder except `keepPath`. Orphaned
 * files are harmless, so a failure here must not fail the profile update.
 */
async function pruneOldAvatars(auth: AuthContext, keepPath: string | null) {
  try {
    const { data: existing, error: listError } = await auth.supabase.storage
      .from(AVATAR_BUCKET)
      .list(auth.userId);

    if (listError) {
      console.error(
        "[pruneOldAvatars] Failed to list avatars (best-effort):",
        listError,
      );
      return;
    }

    const stale = (existing ?? [])
      .map((object) => `${auth.userId}/${object.name}`)
      .filter((path) => path !== keepPath);

    if (stale.length === 0) return;

    const { error: removeError } = await auth.supabase.storage
      .from(AVATAR_BUCKET)
      .remove(stale);

    if (removeError) {
      console.error(
        "[pruneOldAvatars] Failed to remove stale avatars (best-effort):",
        removeError,
      );
    }
  } catch (err) {
    console.error("[pruneOldAvatars] Unexpected failure (best-effort):", err);
  }
}

/**
 * Points the profile at an already-uploaded avatar, or clears it when `path` is
 * null. Takes a storage path rather than a URL so the public URL is derived
 * here and a caller cannot point the profile at an arbitrary address.
 */
export async function updateUserAvatar(
  auth: AuthContext,
  path: string | null,
): Promise<UserProfile> {
  if (path !== null && !path.startsWith(`${auth.userId}/`)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "That avatar does not belong to you.",
    });
  }

  const avatarUrl =
    path === null
      ? null
      : auth.supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data
          .publicUrl;

  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert({
      id: auth.userId,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single<UserProfile>();

  if (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update avatar",
    });
  }

  await pruneOldAvatars(auth, path);

  return data;
}

const HANDLE_AVAILABILITY_VALUES = [
  "available",
  "own",
  "taken",
  "reserved",
  "invalid",
] as const;

function isHandleAvailability(value: unknown): value is HandleAvailability {
  return (
    typeof value === "string" &&
    (HANDLE_AVAILABILITY_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Case-insensitive handle check against live usernames, historical
 * reservations, and app routes. The database function is the authority so
 * the availability UI and the write trigger agree.
 */
export async function getHandleAvailability(
  auth: AuthContext,
  username: string,
): Promise<HandleAvailability> {
  const trimmed = username.trim();
  if (trimmed.length === 0) return "available";

  const { data, error } = (await auth.supabase.rpc("handle_availability", {
    p_handle: trimmed,
    p_user_id: auth.userId,
  })) as { data: unknown; error: { message: string } | null };

  if (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to check handle",
    });
  }

  if (!isHandleAvailability(data)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to check handle",
    });
  }

  return data;
}

/**
 * True when this profile may claim the handle. The caller's own username is
 * available. Empty means "clear the handle".
 */
export async function isUsernameAvailable(
  auth: AuthContext,
  username: string,
): Promise<boolean> {
  const status = await getHandleAvailability(auth, username);
  return status === "available" || status === "own";
}

/** First free handle derived from an author name, or null when none fit. */
export async function suggestAvailableHandle(
  auth: AuthContext,
  authorName: string,
): Promise<string | null> {
  const candidates = enumerateHandleCandidates(authorName, 8);
  for (const candidate of candidates) {
    const status = await getHandleAvailability(auth, candidate);
    if (status === "available" || status === "own") return candidate;
  }
  return null;
}
