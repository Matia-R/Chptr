/**
 * Public handle rules. `profiles.username` is the handle; published URLs stay
 * `/{username}/{slug}`. The database trigger in
 * `migrations/profiles_author_name_and_handles.sql` enforces the same rules
 * atomically — keep the reserved-route list in that file in sync with
 * `RESERVED_HANDLES`.
 */

export const HANDLE_MIN_LENGTH = 2;
export const HANDLE_MAX_LENGTH = 50;
export const AUTHOR_NAME_MAX_LENGTH = 100;

/** First path segments owned by the app, not by an author. */
export const RESERVED_HANDLES = [
  "api",
  "documents",
  "account",
  "login",
  "signup",
  "welcome",
  "onboarding",
  "error",
  "auth",
] as const;

const HANDLE_PATTERN = /^[a-z0-9_-]+$/;

const RESERVED_HANDLE_SET = new Set<string>(RESERVED_HANDLES);

export type HandleFormatRejection = "invalid" | "reserved";
export type HandleClaimRejection = HandleFormatRejection | "taken";

export type HandleAvailability =
  | "available"
  | "own"
  | "taken"
  | "reserved"
  | "invalid";

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLE_SET.has(normalizeHandle(handle));
}

export function validateHandleFormat(
  raw: string,
): { ok: true; handle: string } | { ok: false; reason: HandleFormatRejection } {
  const handle = normalizeHandle(raw);
  if (
    handle.length < HANDLE_MIN_LENGTH ||
    handle.length > HANDLE_MAX_LENGTH ||
    !HANDLE_PATTERN.test(handle)
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (isReservedHandle(handle)) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, handle };
}

/**
 * Profile byline backfill: existing author name, else trimmed first + last,
 * else username. Matches the migration update.
 */
export function backfillAuthorName(input: {
  authorName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string | null {
  const existing = input.authorName?.trim() ?? "";
  if (existing.length > 0) {
    return clipAuthorName(existing);
  }

  const fromNames = [input.firstName, input.lastName]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");
  if (fromNames.length > 0) {
    return clipAuthorName(fromNames);
  }

  const username = input.username?.trim() ?? "";
  if (username.length > 0) {
    return clipAuthorName(username);
  }

  return null;
}

function clipAuthorName(value: string): string | null {
  const clipped = value.slice(0, AUTHOR_NAME_MAX_LENGTH).trim();
  return clipped.length > 0 ? clipped : null;
}

/** Lowercase hyphenated stem of an author name, before collision suffixes. */
export function handleBaseFromAuthorName(authorName: string): string {
  const base = authorName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "";
  if (base.length <= HANDLE_MAX_LENGTH) return base;
  return base.slice(0, HANDLE_MAX_LENGTH).replace(/-+$/g, "");
}

/**
 * Candidate handles in preference order. Skips reserved routes and invalid
 * shapes. Does not consult availability — callers filter taken handles.
 */
export function enumerateHandleCandidates(
  authorName: string,
  limit: number,
): string[] {
  const base = handleBaseFromAuthorName(authorName);
  if (!base || limit <= 0) return [];

  const candidates: string[] = [];
  for (let i = 0; i < 64 && candidates.length < limit; i++) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    const room = HANDLE_MAX_LENGTH - suffix.length;
    if (room < 1) break;
    const stem = base.slice(0, room).replace(/-+$/g, "");
    if (!stem) continue;
    const candidate = `${stem}${suffix}`;
    if (!validateHandleFormat(candidate).ok) continue;
    candidates.push(candidate);
  }
  return candidates;
}

/** First valid handle for an author name. Does not check whether it is free. */
export function suggestedHandleFromAuthorName(authorName: string): string {
  return enumerateHandleCandidates(authorName, 1)[0] ?? "";
}

/** First `limit` candidates that pass format rules and `isTaken`. */
export function suggestHandles(
  authorName: string,
  isTaken: (handle: string) => boolean,
  limit = 1,
): string[] {
  const suggestions: string[] = [];
  for (const candidate of enumerateHandleCandidates(authorName, 64)) {
    if (isTaken(candidate)) continue;
    suggestions.push(candidate);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

export type HandleStore = {
  /** Normalized handle → profile id. */
  usernames: Map<string, string>;
  /** Normalized historical handle → profile id. */
  reservations: Map<string, string>;
};

export function createHandleStore(): HandleStore {
  return { usernames: new Map(), reservations: new Map() };
}

export type ClaimResult =
  | { ok: true; store: HandleStore }
  | { ok: false; reason: HandleClaimRejection };

/**
 * In-memory twin of `enforce_profile_handle`. Callers must serialize claims
 * of the same handle (the database uses an advisory lock plus unique indexes).
 * A profile may reclaim its own reservation. Another profile's username or
 * historical handle is rejected. Clearing the handle reserves the old one.
 */
export function claimHandle(
  store: HandleStore,
  profileId: string,
  rawHandle: string | null,
): ClaimResult {
  const next = cloneHandleStore(store);
  const current = usernameFor(next, profileId);

  if (rawHandle === null || rawHandle.trim().length === 0) {
    if (current) reserveHandle(next, current, profileId);
    clearUsername(next, profileId);
    return { ok: true, store: next };
  }

  const parsed = validateHandleFormat(rawHandle);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const owner = next.usernames.get(parsed.handle);
  if (owner && owner !== profileId) {
    return { ok: false, reason: "taken" };
  }

  const reservedBy = next.reservations.get(parsed.handle);
  if (reservedBy && reservedBy !== profileId) {
    return { ok: false, reason: "reserved" };
  }

  if (reservedBy === profileId) {
    next.reservations.delete(parsed.handle);
  }

  if (current && current !== parsed.handle) {
    reserveHandle(next, current, profileId);
  }

  clearUsername(next, profileId);
  next.usernames.set(parsed.handle, profileId);
  return { ok: true, store: next };
}

/**
 * Assigns a username from the latest publication owner segment when the
 * profile has none, so existing `/{owner}/{slug}` URLs stay attached to the
 * handle. One segment can only be given to one profile.
 */
export function backfillUsernamesFromPublications(input: {
  profiles: { id: string; username: string | null }[];
  publications: {
    creatorId: string;
    ownerUsername: string;
    updatedAt: string;
  }[];
}): { id: string; username: string }[] {
  const taken = new Set<string>();
  for (const profile of input.profiles) {
    const handle = profile.username?.trim().toLowerCase() ?? "";
    if (handle) taken.add(handle);
  }

  const latest = new Map<
    string,
    { ownerUsername: string; updatedAt: string }
  >();
  for (const publication of input.publications) {
    const current = latest.get(publication.creatorId);
    if (!current || publication.updatedAt > current.updatedAt) {
      latest.set(publication.creatorId, {
        ownerUsername: publication.ownerUsername,
        updatedAt: publication.updatedAt,
      });
    }
  }

  const missing = input.profiles
    .filter((profile) => (profile.username?.trim() ?? "") === "")
    .map((profile) => ({
      id: profile.id,
      ownerUsername: latest.get(profile.id)?.ownerUsername ?? "",
    }))
    .filter((row) => row.ownerUsername.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const assignments: { id: string; username: string }[] = [];
  for (const row of missing) {
    const handle = row.ownerUsername.trim().toLowerCase();
    if (!handle || taken.has(handle)) continue;
    taken.add(handle);
    assignments.push({ id: row.id, username: handle });
  }
  return assignments;
}

export function friendlyHandleError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("author name")) {
    return "Author name must be at most 100 characters.";
  }
  if (normalized.includes("reserved") || normalized.includes("not allowed")) {
    return "That handle is reserved.";
  }
  if (normalized.includes("invalid")) {
    return "Use 2–50 letters, numbers, hyphens, or underscores.";
  }
  return "That handle is already taken.";
}

function reserveHandle(store: HandleStore, handle: string, profileId: string) {
  if (!store.reservations.has(handle)) {
    store.reservations.set(handle, profileId);
  }
}

function usernameFor(store: HandleStore, profileId: string): string | null {
  for (const [handle, owner] of store.usernames) {
    if (owner === profileId) return handle;
  }
  return null;
}

function clearUsername(store: HandleStore, profileId: string) {
  for (const [handle, owner] of store.usernames) {
    if (owner === profileId) store.usernames.delete(handle);
  }
}

function cloneHandleStore(store: HandleStore): HandleStore {
  return {
    usernames: new Map(store.usernames),
    reservations: new Map(store.reservations),
  };
}
