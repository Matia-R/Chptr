"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { isDocumentUnavailableError } from "~/lib/document-access-error";

type DocumentUnavailableState = {
  isUnavailable: boolean;
  setUnavailable: (isUnavailable: boolean) => void;
};

export const useDocumentUnavailableStore = create<DocumentUnavailableState>(
  (set) => ({
    isUnavailable: false,
    setUnavailable: (isUnavailable) => set({ isUnavailable }),
  }),
);

/** Publish missing/no-access load errors to the documents shell empty state. */
export function useReportDocumentUnavailable(error: unknown): boolean {
  const setUnavailable = useDocumentUnavailableStore(
    (state) => state.setUnavailable,
  );
  const isUnavailable = isDocumentUnavailableError(error);

  useEffect(() => {
    setUnavailable(isUnavailable);
    return () => {
      setUnavailable(false);
    };
  }, [isUnavailable, setUnavailable]);

  return isUnavailable;
}
