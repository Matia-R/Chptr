import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import { PublishedDocumentView } from "~/app/_components/published-document-view";

import { renderPublishedArticle } from "./blocks/render-article";
import {
  authorDisplayLabel,
  getCachedPublicationRedirectByUsernameSlug,
  getPublicationWithAuthorByUsernameSlug,
} from "~/server/db/document-publications";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ username: string; slug: string }>;
};

async function resolveRedirectOrContinue(username: string, slug: string) {
  const redirect = await getCachedPublicationRedirectByUsernameSlug(
    username,
    slug,
  );
  if (redirect) {
    permanentRedirect(`/${redirect.toOwnerUsername}/${redirect.toSlug}`);
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  await resolveRedirectOrContinue(username, slug);

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
  await resolveRedirectOrContinue(username, slug);

  const data = await getPublicationWithAuthorByUsernameSlug(username, slug);

  if (!data) {
    notFound();
  }

  const { publication, authorProfile } = data;
  const article = await renderPublishedArticle(publication.blocks_json);

  return (
    <PublishedDocumentView
      title={publication.title}
      authorProfile={authorProfile}
      ownerUsername={publication.owner_username}
      slug={publication.slug}
      publishedAt={publication.published_at}
    >
      {article}
    </PublishedDocumentView>
  );
}
