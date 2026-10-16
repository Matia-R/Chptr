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

/** First `count` Unicode code points. Indexing and `slice` count UTF-16 units. */
function leadingCodePoints(value: string, count: number): string {
  let result = "";
  let taken = 0;
  for (const character of value) {
    if (taken === count) break;
    result += character;
    taken += 1;
  }
  return result;
}

function upperCodePoint(character: string): string {
  const upper = character.toUpperCase();
  return [...upper].length === 1 ? upper : character;
}

function lettersIn(value: string): string[] {
  return [...value].filter((character) => /^\p{L}$/u.test(character));
}

/**
 * Avatar mark, at most two characters.
 *
 * Spaces and dashes separate names. "Mary Jane Watson" and "Anne-Marie Bernard"
 * both use the first letter of the first name and the first letter of the last.
 * One name uses its first two letters ("Ada" → "AD"). A single letter stays as
 * it is. When the name has no letters, the first character is used ("🌟"), and
 * an empty name is "?".
 */
export function authorInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  const parts = trimmed
    .split(/[\s\p{Pd}]+/u)
    .map(lettersIn)
    .filter((letters) => letters.length > 0);

  let marks: string[] = [];
  if (parts.length >= 2) {
    marks = [parts[0]?.[0] ?? "", parts[parts.length - 1]?.[0] ?? ""];
  } else if (parts.length === 1) {
    marks = (parts[0] ?? []).slice(0, 2);
  } else {
    marks = [...leadingCodePoints(trimmed, 1)];
  }

  const initials = marks.filter(Boolean).map(upperCodePoint).join("");
  return initials.length > 0 ? initials : "?";
}

export function authorDisplayLabel(
  profile: PublishedAuthorProfileRow | null,
  ownerUsername: string,
): string {
  return authorDisplayName(profile) ?? ownerUsername;
}
