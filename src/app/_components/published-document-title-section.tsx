import { UserAvatar } from "~/app/_components/user-avatar";
import {
  authorDisplayLabel,
  authorInitials,
  type PublishedAuthorProfileRow,
} from "~/lib/published-author";
import { cn } from "~/lib/utils";

function formatPublishedDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export type PublishedDocumentTitleSectionProps = {
  title: string;
  authorProfile: PublishedAuthorProfileRow | null;
  ownerUsername: string;
  publishedAt: string;
  /** Phone-width preview: keep the smaller title even on a wide screen. */
  compact?: boolean;
};

export function PublishedDocumentTitleSection({
  title,
  authorProfile,
  ownerUsername,
  publishedAt,
  compact = false,
}: PublishedDocumentTitleSectionProps) {
  const authorLabel = authorDisplayLabel(authorProfile, ownerUsername);
  const dateLabel = formatPublishedDate(publishedAt);

  return (
    <section
      className={cn("mx-auto max-w-3xl px-4 pt-10", !compact && "md:pt-14")}
    >
      <h1
        className={cn(
          "document-title mb-6 break-words text-3xl font-semibold tracking-tight text-foreground",
          !compact && "md:text-4xl",
        )}
      >
        {title}
      </h1>
      <div className="mb-10 flex items-center gap-3 border-b pb-4 font-sans">
        <UserAvatar
          name={authorLabel}
          avatar_url={authorProfile?.avatar_url ?? null}
          default_avatar_background_color={
            authorProfile?.default_avatar_background_color ?? null
          }
          initials={authorInitials(authorLabel)}
          alt={authorLabel}
          className="h-12 w-12 rounded-full"
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
