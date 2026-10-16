export type HandleChangePublication = {
  documentId: string;
  ownerUsername: string;
  slug: string;
};

export type HandleChangeBlock = {
  documentId: string;
  slug: string;
};

export type HandleChangeMove = {
  documentId: string;
  fromOwnerUsername: string;
  fromSlug: string;
  toOwnerUsername: string;
  toSlug: string;
};

export type HandleChangePlan =
  | { ok: true; moves: HandleChangeMove[] }
  | { ok: false; reason: "slug-conflict"; slug: string };

/**
 * What a handle change does to published paths. Slugs stay put; the owner
 * segment moves. A redirect that already reserves `next/slug` for another
 * document, or two of this author's documents sharing a slug, blocks the move
 * so the unique `(owner_username, slug)` index is not violated.
 */
export function planOwnerHandleChange(input: {
  publications: HandleChangePublication[];
  nextOwnerUsername: string;
  blockingRedirects: HandleChangeBlock[];
}): HandleChangePlan {
  const moves: HandleChangeMove[] = [];
  const slugs = new Set<string>();

  for (const publication of input.publications) {
    if (publication.ownerUsername === input.nextOwnerUsername) continue;

    if (slugs.has(publication.slug)) {
      return { ok: false, reason: "slug-conflict", slug: publication.slug };
    }
    slugs.add(publication.slug);

    const block = input.blockingRedirects.find(
      (redirect) =>
        redirect.slug === publication.slug &&
        redirect.documentId !== publication.documentId,
    );
    if (block) {
      return { ok: false, reason: "slug-conflict", slug: publication.slug };
    }

    moves.push({
      documentId: publication.documentId,
      fromOwnerUsername: publication.ownerUsername,
      fromSlug: publication.slug,
      toOwnerUsername: input.nextOwnerUsername,
      toSlug: publication.slug,
    });
  }

  return { ok: true, moves };
}
