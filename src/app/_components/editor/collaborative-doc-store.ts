"use client";

import { create } from "zustand";
import type * as Y from "yjs";

type CollaborativeDocState = {
  documentId: string | null;
  ydoc: Y.Doc | null;
  /** False until the documents row exists (PartyKit connect creates new docs). */
  isPersisted: boolean;
  /** Live Yjs body differs from the last published snapshot in the shared Y.Map. */
  isYjsContentDirty: boolean;
  /** False for docs that have never been published with a Yjs snapshot. */
  hasYjsPublishHash: boolean;
  bindDocument: (input: { documentId: string; isPersisted: boolean }) => void;
  setYdoc: (ydoc: Y.Doc | null) => void;
  setPersisted: (isPersisted: boolean) => void;
  setYjsPublishState: (input: {
    isYjsContentDirty: boolean;
    hasYjsPublishHash: boolean;
  }) => void;
  reset: () => void;
};

const initialState = {
  documentId: null as string | null,
  ydoc: null as Y.Doc | null,
  isPersisted: false,
  isYjsContentDirty: false,
  hasYjsPublishHash: false,
};

export const useCollaborativeDocStore = create<CollaborativeDocState>(
  (set) => ({
    ...initialState,
    bindDocument: ({ documentId, isPersisted }) =>
      set((state) =>
        state.documentId === documentId
          ? { isPersisted }
          : {
              ...initialState,
              documentId,
              isPersisted,
            },
      ),
    setYdoc: (ydoc) => set({ ydoc }),
    setPersisted: (isPersisted) => set({ isPersisted }),
    setYjsPublishState: ({ isYjsContentDirty, hasYjsPublishHash }) =>
      set({ isYjsContentDirty, hasYjsPublishHash }),
    reset: () => set(initialState),
  }),
);

/** True when this route's document row exists and queries are safe to run. */
export function useDocumentIsPersisted(
  documentId: string | undefined,
): boolean {
  const boundId = useCollaborativeDocStore((s) => s.documentId);
  const isPersisted = useCollaborativeDocStore((s) => s.isPersisted);
  return !!documentId && boundId === documentId && isPersisted;
}
