"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "~/trpc/react";

export type DocumentListItem = { id: string; name: string };

export type TrashedDocumentListItem = {
  id: string;
  name: string;
  deletedAt: string;
};

type DocumentListSeed = {
  documents: DocumentListItem[];
  trashedDocuments: TrashedDocumentListItem[];
};

const EMPTY_SEED: DocumentListSeed = {
  documents: [],
  trashedDocuments: [],
};

const DocumentListSeedContext = createContext<DocumentListSeed>(EMPTY_SEED);

export function DocumentListSeedProvider({
  documents,
  trashedDocuments,
  children,
}: DocumentListSeed & { children: ReactNode }) {
  const value = useMemo(
    () => ({ documents, trashedDocuments }),
    [documents, trashedDocuments],
  );

  return (
    <DocumentListSeedContext.Provider value={value}>
      {children}
    </DocumentListSeedContext.Provider>
  );
}

function seededList(seed: DocumentListSeed) {
  return {
    success: true as const,
    documents: seed.documents,
    trashedDocuments: seed.trashedDocuments,
  };
}

/** Shared list query. Server seed keeps the sidebar and trash painted on refresh. */
export function useDocumentList() {
  const seed = useContext(DocumentListSeedContext);
  const seeded = seededList(seed);

  return api.document.getDocumentIdsForAuthenticatedUser.useQuery(undefined, {
    initialData: seeded,
    placeholderData: (previous) => previous ?? seeded,
    refetchOnMount: true,
  });
}

export function useTrashedDocuments() {
  const { data } = useDocumentList();
  return data?.trashedDocuments ?? [];
}

/**
 * Document name already in the sidebar / command-menu list cache.
 * Instant on in-app switches; undefined for docs that are not in that list yet.
 */
export function useKnownDocumentName(
  documentId: string | undefined,
): string | undefined {
  const { data } = useDocumentList();
  if (!documentId) return undefined;
  return data?.documents?.find((doc) => doc.id === documentId)?.name;
}
