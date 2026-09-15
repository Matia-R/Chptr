"use client";

import { createContext, useContext, type ReactNode } from "react";
import { api } from "~/trpc/react";

export type DocumentListItem = { id: string; name: string };

const DocumentListSeedContext = createContext<DocumentListItem[]>([]);

export function DocumentListSeedProvider({
  documents,
  children,
}: {
  documents: DocumentListItem[];
  children: ReactNode;
}) {
  return (
    <DocumentListSeedContext.Provider value={documents}>
      {children}
    </DocumentListSeedContext.Provider>
  );
}

function seededList(documents: DocumentListItem[]) {
  return { success: true as const, documents };
}

/** Shared list query. Server seed keeps the sidebar painted on refresh. */
export function useDocumentList() {
  const seed = useContext(DocumentListSeedContext);
  const seeded = seededList(seed);

  return api.document.getDocumentIdsForAuthenticatedUser.useQuery(undefined, {
    initialData: seeded,
    placeholderData: (previous) => previous ?? seeded,
    refetchOnMount: true,
  });
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
