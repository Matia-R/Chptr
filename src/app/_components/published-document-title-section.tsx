import { UserAvatar } from "~/app/_components/user-avatar";
import {
  authorDisplayLabel,
  type PublishedAuthorProfileRow,
} from "~/server/db/document-publications";

function formatPublishedDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Matches NavUser: first + last initial, else derived from display label. */
function authorAvatarInitials(
  authorProfile: {
    first_name: string | null;
    last_name: string | null;
  } | null,
  displayLabel: string,
): string {
  const fromProfile =
    `${authorProfile?.first_name?.[0] ?? ""}${authorProfile?.last_name?.[0] ?? ""}`.toUpperCase();
  if (fromProfile) return fromProfile;

  const parts = displayLabel.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.slice(0, 1);
    const b = parts[parts.length - 1]!.slice(0, 1);
    return (a + b).toUpperCase();
  }
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "?";
}

export type PublishedDocumentTitleSectionProps = {
  title: string;
  authorProfile: PublishedAuthorProfileRow | null;
  ownerUsername: string;
  publishedAt: string;
};

export function PublishedDocumentTitleSection({
  title,
  authorProfile,
  ownerUsername,
  publishedAt,
}: PublishedDocumentTitleSectionProps) {
  const authorLabel = authorDisplayLabel(authorProfile, ownerUsername);
  const dateLabel = formatPublishedDate(publishedAt);

  return (
    <section className="mx-auto max-w-3xl px-4 pt-10 md:pt-14">
      <h1 className="mb-6 font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      <div className="mb-10 flex items-center gap-3 border-b pb-4">
        <UserAvatar
          first_name={authorProfile?.first_name ?? null}
          last_name={authorProfile?.last_name ?? null}
          avatar_url={authorProfile?.avatar_url ?? null}
          default_avatar_background_color={
            authorProfile?.default_avatar_background_color ?? null
          }
          initials={authorAvatarInitials(authorProfile, authorLabel)}
          alt={authorLabel}
          className="h-12 w-12 rounded-lg"
        />
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-foreground">{authorLabel}</p>
          <p className="text-sm text-muted-foreground">
            <time dateTime={publishedAt}>{dateLabel}</time>
          </p>
        </div>
      </div>
    </section>
  );
}
