/** Fields needed for the published-page author row (from `profiles`). */
export type PublishedAuthorProfileRow = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  default_avatar_background_color: string | null;
};

export function authorDisplayLabel(
  profile: PublishedAuthorProfileRow | null,
  ownerUsername: string,
): string {
  if (!profile) return ownerUsername;
  const parts = [profile.first_name, profile.last_name]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));
  if (parts.length > 0) return parts.join(" ");
  const u = profile.username?.trim();
  if (u) return u;
  return ownerUsername;
}
