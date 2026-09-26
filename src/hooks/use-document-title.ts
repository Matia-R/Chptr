"use client";

import { useCallback, useEffect, useRef } from "react";

import { useDocumentIsPersisted } from "~/app/_components/editor/collaborative-doc-store";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import {
  applyDocumentName,
  broadcastDocumentName,
} from "~/hooks/use-document-meta-sync";
import { useKnownDocumentName } from "~/hooks/use-known-document-name";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

// Only the latest title preview for a document may reach persistence.
const persistTimers = new Map<string, number>();

function getCachedDocumentName(
  utils: ReturnType<typeof api.useUtils>,
  documentId: string,
) {
  return (
    utils.document.getDocumentById.getData(documentId)?.document?.name ??
    utils.document.getDocumentIdsForAuthenticatedUser
      .getData()
      ?.documents?.find((doc) => doc.id === documentId)?.name
  );
}

/**
 * Document name shared by the header title control and the editor heading.
 * Cache updates are immediate so both surfaces stay in sync; the server write
 * is debounced while typing and flushed on commit.
 */
export function useDocumentTitle() {
  const documentId = useRouteDocumentId() ?? "";
  const { isNew, clearFlag } = useNewDocumentFlag();
  const isPersisted = useDocumentIsPersisted(documentId);
  const isOffline = useBrowserOffline();
  const utils = api.useUtils();
  const { toast } = useToast();
  const knownName = useKnownDocumentName(documentId);
  const persistTimer = useRef<number | null>(null);
  /** Name to restore if this edit is cleared before it should stick. */
  const editBaselineRef = useRef<string | null>(null);
  const didPersistPreviewRef = useRef(false);

  const { data: document, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && (!isNew || isPersisted),
    },
  );

  const fetchedName = document?.document?.name;
  const name =
    fetchedName ?? knownName ?? (isNew ? "Untitled" : undefined);

  const updateName = api.document.updateDocumentName.useMutation({
    onMutate: ({ id, name: nextName }) => {
      const previousName =
        getCachedDocumentName(utils, id) ?? name ?? "Untitled";
      applyDocumentName(utils, id, nextName);
      broadcastDocumentName(id, nextName);
      return { previousName, optimisticName: nextName };
    },
    onError: (err, { id }, context) => {
      if (
        context &&
        getCachedDocumentName(utils, id) === context.optimisticName
      ) {
        applyDocumentName(utils, id, context.previousName);
        broadcastDocumentName(id, context.previousName);
      }

      toast({
        variant: "destructive",
        title: "Failed to update document name",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    },
    onSettled: (_data, _error, { id }, context) => {
      const cachedName = getCachedDocumentName(utils, id);
      if (
        context &&
        cachedName !== undefined &&
        cachedName !== context.optimisticName &&
        cachedName !== context.previousName
      ) {
        return;
      }

      void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
      void utils.document.getDocumentById.invalidate(id);
    },
  });

  const clearPersistTimer = useCallback(() => {
    const timer = persistTimers.get(documentId);
    if (timer !== undefined) window.clearTimeout(timer);
    persistTimers.delete(documentId);
    persistTimer.current = null;
  }, [documentId]);

  useEffect(() => {
    editBaselineRef.current = null;
    didPersistPreviewRef.current = false;
    return () => {
      // Unmounting another title surface must not discard the active preview.
      if (persistTimers.get(documentId) === persistTimer.current) {
        clearPersistTimer();
      }
    };
  }, [clearPersistTimer, documentId]);

  const persistName = useCallback(
    (trimmedName: string) => {
      if (!documentId || isOffline) return;
      if (isNew) clearFlag();
      updateName.mutate({ id: documentId, name: trimmedName });
    },
    [clearFlag, documentId, isNew, isOffline, updateName],
  );

  const restoreBaseline = useCallback(() => {
    const baseline = editBaselineRef.current ?? name ?? "Untitled";
    applyDocumentName(utils, documentId, baseline);
    broadcastDocumentName(documentId, baseline);
    return baseline;
  }, [documentId, name, utils]);

  const cancelTitle = useCallback(() => {
    clearPersistTimer();
    const baseline = restoreBaseline();
    editBaselineRef.current = null;
    if (didPersistPreviewRef.current) persistName(baseline);
    didPersistPreviewRef.current = false;
    return baseline;
  }, [clearPersistTimer, persistName, restoreBaseline]);

  const commitTitle = useCallback(
    (nextName: string) => {
      clearPersistTimer();
      const trimmedName = nextName.trim();
      const baseline = editBaselineRef.current ?? name ?? "Untitled";
      if (!trimmedName || trimmedName === baseline) {
        return cancelTitle();
      }

      editBaselineRef.current = null;
      didPersistPreviewRef.current = false;
      persistName(trimmedName);
      return trimmedName;
    },
    [cancelTitle, clearPersistTimer, name, persistName],
  );

  /** Paint the name in every title surface immediately, then save. */
  const previewTitle = useCallback(
    (nextName: string) => {
      if (!documentId || isOffline) return;
      if (editBaselineRef.current == null) {
        editBaselineRef.current = name ?? "Untitled";
      }

      clearPersistTimer();
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        restoreBaseline();
        return;
      }

      applyDocumentName(utils, documentId, nextName);
      broadcastDocumentName(documentId, nextName);
      const timer = window.setTimeout(() => {
        if (persistTimers.get(documentId) !== timer) return;
        persistTimers.delete(documentId);
        persistTimer.current = null;
        didPersistPreviewRef.current = true;
        persistName(trimmedName);
      }, 400);
      persistTimer.current = timer;
      persistTimers.set(documentId, timer);
    },
    [
      clearPersistTimer,
      documentId,
      isOffline,
      name,
      persistName,
      restoreBaseline,
      utils,
    ],
  );

  return {
    documentId,
    name,
    isLoading: isLoading && !isNew && name === undefined,
    isOffline,
    commitTitle,
    cancelTitle,
    previewTitle,
  };
}
