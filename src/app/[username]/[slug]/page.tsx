import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { UserAvatar } from "~/app/_components/user-avatar";
import { sanitizePublishedHtml } from "~/lib/published-html";
import {
  authorDisplayLabel,
  getPublicationWithAuthorByUsernameSlug,
} from "~/server/db/document-publications";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getPublicationWithAuthorByUsernameSlug(username, slug);

  if (!data) {
    return { title: "Not found — Chptr" };
  }

  const { publication, authorProfile } = data;
  const path = `/${publication.owner_username}/${publication.slug}`;
  const title = `${publication.title} — Chptr`;
  const by = authorDisplayLabel(authorProfile, publication.owner_username);

  return {
    title,
    description: `Published document by ${by} on Chptr.`,
    openGraph: {
      title,
      type: "article",
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
    },
    alternates: {
      canonical: path,
    },
  };
}

export default async function PublishedDocumentPage({ params }: PageProps) {
  const { username, slug } = await params;
  const data = await getPublicationWithAuthorByUsernameSlug(username, slug);

  if (!data) {
    notFound();
  }

  const { publication, authorProfile } = data;
  const safeHtml = sanitizePublishedHtml(publication.body_html);
  const authorLabel = authorDisplayLabel(
    authorProfile,
    publication.owner_username,
  );
  const dateLabel = formatPublishedDate(publication.published_at);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          <p className="min-w-0 truncate text-left text-sm text-muted-foreground">
            <span className="text-foreground/90">
              {publication.owner_username}
            </span>
            <span className="mx-1.5 text-border">/</span>
            <span>{publication.slug}</span>
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-10 md:pt-14">
        <h1 className="mb-6 font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {publication.title}
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
              <time dateTime={publication.published_at}>{dateLabel}</time>
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <article
          className="bn-shadcn published-document-content text-[1.05rem] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </main>
    </div>
  );
}
