"use client";

import { useCallback, useSyncExternalStore } from "react";
import type * as Y from "yjs";

import { useCollaborativeDocStore } from "~/app/_components/editor/collaborative-doc-store";
import {
  readDocumentFontId,
  writeDocumentFontId,
} from "~/lib/document-font-state";
import type { DocumentFontId } from "~/lib/document-fonts";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";

function getServerFontSnapshot() {
  return null;
}

function subscribeToDocumentFont(
  ydoc: Y.Doc | null,
  onStoreChange: () => void,
) {
  if (!ydoc) return () => {};
  // Doc-level updates, not getMap: creating the meta map would persist an edit.
  // React skips the re-render when the font id is unchanged.
  ydoc.on("update", onStoreChange);
  return () => {
    ydoc.off("update", onStoreChange);
  };
}

/**
 * Live document face. `fontId` stays null until the Y.Doc has been loaded so
 * the menu does not flash Inter before the saved face is known.
 */
export function useDocumentFont() {
  const documentId = useRouteDocumentId();
  const ydoc = useCollaborativeDocStore((state) =>
    documentId && state.documentId === documentId ? state.ydoc : null,
  );
  const ready = useCollaborativeDocStore(
    (state) =>
      !!documentId && state.documentId === documentId && state.isContentReady,
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToDocumentFont(ydoc, onStoreChange),
    [ydoc],
  );
  const getSnapshot = useCallback(
    () => (ydoc ? readDocumentFontId(ydoc) : null),
    [ydoc],
  );

  const liveFontId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerFontSnapshot,
  );

  const fontId = ready && ydoc && liveFontId ? liveFontId : null;

  const selectFont = useCallback(
    (next: DocumentFontId) => {
      const state = useCollaborativeDocStore.getState();
      if (
        !documentId ||
        state.documentId !== documentId ||
        !state.ydoc ||
        !state.isContentReady
      ) {
        return false;
      }
      writeDocumentFontId(state.ydoc, next);
      return true;
    },
    [documentId],
  );

  return { fontId, ready: fontId != null, selectFont };
}
