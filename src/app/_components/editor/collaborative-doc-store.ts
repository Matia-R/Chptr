"use client";

import { create } from "zustand";
import type * as Y from "yjs";

type YjsPublishMemory = {
  isYjsContentDirty: boolean;
  hasYjsPublishHash: boolean;
};

type CollaborativeDocState = {
  documentId: string | null;
  ydoc: Y.Doc | null;
  /** False until the documents row exists (PartyKit connect creates new docs). */
  isPersisted: boolean;
  /** Live Yjs body differs from the last published snapshot in the shared Y.Map. */
  isYjsContentDirty: boolean;
  /** False for docs that have never been published with a Yjs snapshot. */
  hasYjsPublishHash: boolean;
  /** True after the first post-sync Yjs publish comparison for the bound doc. */
  isYjsPublishReady: boolean;
  /**
   * Last live publish comparison per document. Survives navigate / reset.
   * `getDocumentState` cannot replace this: hover prefetch is a no-op while
   * the React Query cache is fresh, and that cache is the last fetch — not
   * the Y.Doc the user just edited (PartyKit save is also debounced).
   */
  yjsPublishByDocumentId: Record<string, YjsPublishMemory>;
  bindDocument: (input: { documentId: string; isPersisted: boolean }) => void;
  setYdoc: (ydoc: Y.Doc | null) => void;
  setPersisted: (isPersisted: boolean) => void;
  setYjsPublishState: (input: {
    isYjsContentDirty: boolean;
    hasYjsPublishHash: boolean;
  }) => void;
  reset: () => void;
};

const initialBoundState = {
  documentId: null as string | null,
  ydoc: null as Y.Doc | null,
  isPersisted: false,
  isYjsContentDirty: false,
  hasYjsPublishHash: false,
  isYjsPublishReady: false,
};

export const useCollaborativeDocStore = create<CollaborativeDocState>(
  (set) => ({
    ...initialBoundState,
    yjsPublishByDocumentId: {},
    bindDocument: ({ documentId, isPersisted }) =>
      set((state) =>
        state.documentId === documentId
          ? { isPersisted }
          : {
              ...initialBoundState,
              documentId,
              isPersisted,
              yjsPublishByDocumentId: state.yjsPublishByDocumentId,
            },
      ),
    setYdoc: (ydoc) => set({ ydoc }),
    setPersisted: (isPersisted) => set({ isPersisted }),
    setYjsPublishState: ({ isYjsContentDirty, hasYjsPublishHash }) =>
      set((state) => ({
        isYjsContentDirty,
        hasYjsPublishHash,
        isYjsPublishReady: true,
        yjsPublishByDocumentId: state.documentId
          ? {
              ...state.yjsPublishByDocumentId,
              [state.documentId]: { isYjsContentDirty, hasYjsPublishHash },
            }
          : state.yjsPublishByDocumentId,
      })),
    reset: () =>
      set((state) => ({
        ...initialBoundState,
        yjsPublishByDocumentId: state.yjsPublishByDocumentId,
      })),
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

/** Store fields that belong to another document must not drive this route's UI. */
export function useCollaborativeDocForRoute(documentId: string | undefined) {
  const boundId = useCollaborativeDocStore((s) => s.documentId);
  const isPersisted = useCollaborativeDocStore((s) => s.isPersisted);
  const isYjsContentDirty = useCollaborativeDocStore(
    (s) => s.isYjsContentDirty,
  );
  const hasYjsPublishHash = useCollaborativeDocStore(
    (s) => s.hasYjsPublishHash,
  );
  const isYjsPublishReady = useCollaborativeDocStore(
    (s) => s.isYjsPublishReady,
  );
  const remembered = useCollaborativeDocStore((s) =>
    documentId ? s.yjsPublishByDocumentId[documentId] : undefined,
  );
  const aligned = !!documentId && boundId === documentId;
  const liveReady = aligned && isYjsPublishReady;
  return {
    aligned,
    isPersisted: aligned && isPersisted,
    isYjsContentDirty: liveReady
      ? isYjsContentDirty
      : (remembered?.isYjsContentDirty ?? false),
    hasYjsPublishHash: liveReady
      ? hasYjsPublishHash
      : (remembered?.hasYjsPublishHash ?? false),
    isYjsPublishReady: liveReady || !!remembered,
  };
}
