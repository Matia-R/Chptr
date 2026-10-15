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
  return s.length > MAX_SLUG_LEN
    ? s.slice(0, MAX_SLUG_LEN).replace(/-+$/g, "")
    : s;
}

const MAX_OWNER_HANDLE_LEN = 50;

export function normalizePublicationUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

/** First URL segment for published docs: the profile handle (`username`). */
export function isValidOwnerPathSegment(segment: string): boolean {
  return (
    segment.length >= 2 &&
    segment.length <= MAX_OWNER_HANDLE_LEN &&
    /^[a-z0-9_-]+$/.test(segment)
  );
}

export function publicationOwnerPathSegment(profile: {
  username: string | null | undefined;
}): string {
  const trimmed = profile.username?.trim();
  if (!trimmed) return "";
  const normalized = normalizePublicationUsername(trimmed);
  return isValidOwnerPathSegment(normalized) ? normalized : "";
}

export function isValidPublicationSlug(slug: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 1 &&
    slug.length <= 200
  );
}
