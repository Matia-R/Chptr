import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublishedDocumentTitleSection } from "~/app/_components/published-document-title-section";
import { sanitizePublishedHtml } from "~/lib/published-html";
import {
  authorDisplayLabel,
  getPublicationWithAuthorByUsernameSlug,
} from "~/server/db/document-publications";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

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

      <PublishedDocumentTitleSection
        title={publication.title}
        authorProfile={authorProfile}
        ownerUsername={publication.owner_username}
        publishedAt={publication.published_at}
      />

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <article
          className="bn-shadcn published-document-content text-[1.05rem] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </main>
    </div>
  );
}
