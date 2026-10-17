/**
 * Post-authentication author onboarding.
 *
 * A profile is onboarded only when `onboarding_completed_at` is set and the
 * required identity is still valid. The timestamp is written by
 * `complete_author_onboarding` — not by generic profile updates. Google
 * metadata is a suggestion until the person confirms it on this flow.
 */

import {
  AUTHOR_NAME_MAX_LENGTH,
  normalizeHandle,
  suggestedHandleFromAuthorName,
  validateHandleFormat,
} from "./author-handle.ts";

export const ONBOARDING_PATH = "/onboarding";

export const ONBOARDING_STEPS = ["name", "handle", "avatar"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingProfile = {
  author_name?: string | null;
  username?: string | null;
  onboarding_completed_at?: string | null;
};

const PRIVATE_PREFIXES = ["/documents", "/welcome", "/account"] as const;

const AUTH_EXACT_PATHS = new Set([
  "/login",
  "/signup",
  "/confirm-signup",
  "/error",
]);

export type AppPathArea = "api" | "public" | "auth" | "onboarding" | "private";

export type AccessDecision =
  | { action: "allow" }
  | { action: "redirect"; pathname: string };

function normalizePathname(pathname: string): string {
  const path = pathname.split("?")[0] ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path.length > 0 ? path : "/";
}

export function classifyAppPath(pathname: string): AppPathArea {
  const path = normalizePathname(pathname);
  if (path.startsWith("/api") || path.startsWith("/_next")) return "api";
  if (path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`)) {
    return "onboarding";
  }
  if (
    PRIVATE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  ) {
    return "private";
  }
  if (AUTH_EXACT_PATHS.has(path) || path.startsWith("/auth/")) return "auth";
  return "public";
}

/** Private app and onboarding: sign-out should leave these for the login page. */
export function isAuthenticatedAppPath(pathname: string): boolean {
  const area = classifyAppPath(pathname);
  return area === "private" || area === "onboarding";
}

/**
 * Middleware should read the profile only when the onboarding bit can change
 * the response. Public articles, auth pages, and APIs skip the lookup.
 */
export function needsOnboardingLookup(pathname: string): boolean {
  const area = classifyAppPath(pathname);
  return area === "private" || area === "onboarding";
}

export function hasRequiredAuthorName(
  value: string | null | undefined,
): boolean {
  const name = value?.trim() ?? "";
  return name.length > 0 && name.length <= AUTHOR_NAME_MAX_LENGTH;
}

export function hasRequiredHandle(value: string | null | undefined): boolean {
  return validateHandleFormat(value ?? "").ok;
}

/**
 * Authoritative completion check. A timestamp without a name and handle does
 * not unlock the app, and a name plus handle without the timestamp does not
 * either.
 */
export function isOnboardingComplete(
  profile: OnboardingProfile | null | undefined,
): boolean {
  if (!profile?.onboarding_completed_at) return false;
  return (
    hasRequiredAuthorName(profile.author_name) &&
    hasRequiredHandle(profile.username)
  );
}

/**
 * Existing accounts that already have a public identity are marked complete
 * by the migration. Accounts missing either field stay in onboarding.
 */
export function qualifiesForOnboardingBackfill(
  profile: OnboardingProfile | null | undefined,
): boolean {
  if (!profile || profile.onboarding_completed_at) return false;
  return (
    hasRequiredAuthorName(profile.author_name) &&
    hasRequiredHandle(profile.username)
  );
}

export function assertCompletedProfileUpdate(
  current: OnboardingProfile | null | undefined,
  next: { author_name: string | null; username: string | null },
): { ok: true } | { ok: false; message: string } {
  if (!current?.onboarding_completed_at) return { ok: true };
  if (!hasRequiredAuthorName(next.author_name)) {
    return { ok: false, message: "Author name is required." };
  }
  if (!hasRequiredHandle(next.username)) {
    return {
      ok: false,
      message:
        "A handle is required. Use 2–50 letters, numbers, hyphens, or underscores.",
    };
  }
  return { ok: true };
}

/**
 * Replacement for an untouched generated handle that the server found was
 * taken. Returns null when the person has edited the field, the current
 * value is no longer the local suggestion, or the alternative is missing
 * or unchanged.
 */
export function generatedHandleToApply(input: {
  edited: boolean;
  authorName: string;
  currentHandle: string;
  unavailable: boolean;
  alternative: string | null;
}): string | null {
  if (input.edited || !input.unavailable) return null;
  const next = input.alternative?.trim() ?? "";
  if (!next) return null;
  const local = suggestedHandleFromAuthorName(input.authorName);
  if (normalizeHandle(input.currentHandle) !== local) return null;
  if (normalizeHandle(next) === local) return null;
  return next;
}

export function onboardingStepHref(step: OnboardingStep): string {
  return `${ONBOARDING_PATH}?step=${step}`;
}

/**
 * Saved identity decides how far someone can skip ahead. Back to an earlier
 * step is always allowed. A missing or unknown step resumes at the first
 * unfinished one.
 */
export function resumeOnboardingStep(
  profile:
    | Pick<OnboardingProfile, "author_name" | "username">
    | null
    | undefined,
  requested: string | null | undefined,
): OnboardingStep {
  const hasName = hasRequiredAuthorName(profile?.author_name);
  const hasHandle = hasRequiredHandle(profile?.username);
  const asked = requested?.trim() ?? "";

  if (asked === "name") return "name";
  if (asked === "handle") return hasName ? "handle" : "name";
  if (asked === "avatar") {
    if (!hasName) return "name";
    if (!hasHandle) return "handle";
    return "avatar";
  }
  if (!hasName) return "name";
  if (!hasHandle) return "handle";
  return "avatar";
}

export function onboardingStepMatchesRequest(
  requested: string | null | undefined,
  resolved: OnboardingStep,
): boolean {
  const asked = requested?.trim() ?? "";
  if (asked.length === 0) return resolved === "name";
  return asked === resolved;
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Google (and any other provider) name is a suggestion. It is not written to
 * `profiles` until the person finishes onboarding.
 */
export function suggestedAuthorNameFromAuthMetadata(
  metadata: unknown,
): string | null {
  const full =
    metadataString(metadata, "full_name") ?? metadataString(metadata, "name");
  if (full) return clipSuggestedName(full);

  const given =
    metadataString(metadata, "given_name") ??
    metadataString(metadata, "first_name");
  const family =
    metadataString(metadata, "family_name") ??
    metadataString(metadata, "last_name");
  const combined = [given, family]
    .filter((part) => part && part.length > 0)
    .join(" ");
  if (combined.length > 0) return clipSuggestedName(combined);
  return null;
}

function clipSuggestedName(value: string): string | null {
  const clipped = value.slice(0, AUTHOR_NAME_MAX_LENGTH).trim();
  return clipped.length > 0 ? clipped : null;
}

/** Provider photo URLs are suggestions. Only https URLs are offered. */
export function suggestedAvatarUrlFromAuthMetadata(
  metadata: unknown,
): string | null {
  const raw =
    metadataString(metadata, "avatar_url") ??
    metadataString(metadata, "picture");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function decideAccess(input: {
  pathname: string;
  authenticated: boolean;
  onboarded: boolean;
}): AccessDecision {
  const area = classifyAppPath(input.pathname);

  if (area === "api") return { action: "allow" };

  if (!input.authenticated) {
    if (area === "private" || area === "onboarding") {
      return { action: "redirect", pathname: "/login" };
    }
    return { action: "allow" };
  }

  if (!input.onboarded) {
    if (area === "private") {
      return { action: "redirect", pathname: ONBOARDING_PATH };
    }
    return { action: "allow" };
  }

  if (area === "onboarding") {
    return { action: "redirect", pathname: "/documents" };
  }
  return { action: "allow" };
}
