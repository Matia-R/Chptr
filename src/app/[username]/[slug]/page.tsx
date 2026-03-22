import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { createClient } from "~/utils/supabase/server";
import { sanitizePublishedHtml } from "~/lib/published-html";
import { getPublicationByUsernameSlug } from "~/server/db/document-publications";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = await createClient();
  const publication = await getPublicationByUsernameSlug(username, slug, supabase);

  if (!publication) {
    return { title: "Not found — Chptr" };
  }

  const path = `/${publication.owner_username}/${publication.slug}`;
  const title = `${publication.title} — Chptr`;

  return {
    title,
    description: `Published document by ${publication.owner_username} on Chptr.`,
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
  const supabase = await createClient();
  const publication = await getPublicationByUsernameSlug(username, slug, supabase);

  if (!publication) {
    notFound();
  }

  const safeHtml = sanitizePublishedHtml(publication.body_html);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Chptr
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            <span className="text-foreground/90">{publication.owner_username}</span>
            <span className="mx-1.5 text-border">/</span>
            <span>{publication.slug}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 md:pt-14">
        <h1 className="mb-10 font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {publication.title}
        </h1>
        <article
          className="bn-shadcn published-document-content text-[1.05rem] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </main>
    </div>
  );
}
