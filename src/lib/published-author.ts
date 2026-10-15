import { AUTHOR_NAME_MAX_LENGTH } from "~/lib/author-handle";

/** Fields needed for the published-page author row (from `profiles`). */
export type PublishedAuthorProfileRow = {
  username: string | null;
  author_name: string | null;
  /** Legacy columns. Used only when `author_name` has not been backfilled. */
  first_name?: string | null;
  last_name?: string | null;
  avatar_url: string | null;
  default_avatar_background_color: string | null;
};

/** Public byline: author name (real or pen), else legacy first + last, else handle. */
export function authorDisplayName(
  profile:
    | {
        author_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!profile) return null;

  const author = profile.author_name?.trim() ?? "";
  if (author.length > 0) {
    return author.slice(0, AUTHOR_NAME_MAX_LENGTH);
  }

  const legacy = [profile.first_name, profile.last_name]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");
  if (legacy.length > 0) return legacy;

  const username = profile.username?.trim() ?? "";
  return username.length > 0 ? username : null;
}

/** First and last initials, else the first two letters, else "?". */
export function authorInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    const initials = `${first}${last}`.toUpperCase();
    return initials.length > 0 ? initials : "?";
  }
  if (parts.length === 1) {
    const word = parts[0] ?? "";
    const initials = word.slice(0, 2).toUpperCase();
    return initials.length > 0 ? initials : "?";
  }
  return "?";
}

export function authorDisplayLabel(
  profile: PublishedAuthorProfileRow | null,
  ownerUsername: string,
): string {
  return authorDisplayName(profile) ?? ownerUsername;
}
