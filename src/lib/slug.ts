const MAX_SLUG_LEN = 80;

/**
 * Convert a display title to a URL slug (lowercase, hyphenated).
 */
export function slugifyTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) return "untitled";
  return s.length > MAX_SLUG_LEN ? s.slice(0, MAX_SLUG_LEN).replace(/-+$/g, "") : s;
}

const MAX_OWNER_HANDLE_LEN = 50;

export function normalizePublicationUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * Public URL path segment for the document owner: `first_name` and `last_name`
 * concatenated (no space), then URL-normalized to match `document_publications.owner_username`.
 */
export function ownerHandleFromProfileNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const a = (firstName ?? "").trim();
  const b = (lastName ?? "").trim();
  const combined = `${a}${b}`;
  let h = normalizePublicationUsername(combined);
  if (h.length > MAX_OWNER_HANDLE_LEN) {
    h = h.slice(0, MAX_OWNER_HANDLE_LEN).replace(/-+$/g, "");
  }
  return h;
}

/** First URL segment for published docs: username if valid, else first+last handle. */
export function isValidOwnerPathSegment(segment: string): boolean {
  return (
    segment.length >= 2 &&
    segment.length <= MAX_OWNER_HANDLE_LEN &&
    /^[a-z0-9_-]+$/.test(segment)
  );
}

export function publicationOwnerPathSegment(profile: {
  username: string | null | undefined;
  first_name: string | null | undefined;
  last_name: string | null | undefined;
}): string {
  const trimmedU = profile.username?.trim();
  if (trimmedU) {
    const u = normalizePublicationUsername(trimmedU);
    if (isValidOwnerPathSegment(u)) {
      return u;
    }
  }
  return ownerHandleFromProfileNames(profile.first_name, profile.last_name);
}

export function isValidPublicationSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 1 && slug.length <= 200;
}
