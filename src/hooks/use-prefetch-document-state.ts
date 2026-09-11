"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";

const DOCUMENT_STATE_STALE_MS = 30_000;

export function usePrefetchDocumentState() {
  const utils = api.useUtils();

  return useCallback(
    (documentId: string) => {
      void utils.document.getDocumentState.prefetch(documentId, {
        staleTime: DOCUMENT_STATE_STALE_MS,
      });
    },
    [utils]
  );
}
