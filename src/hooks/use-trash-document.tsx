"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useCollaborativeDocStore } from "~/app/_components/editor/collaborative-doc-store";
import { useDocumentPublishStore } from "~/app/_components/editor/document-publish-store";
import { ToastAction } from "~/app/_components/toast";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import {
  applyDocumentCreated,
  applyDocumentDeleted,
  applyDocumentMovedToTrash,
  broadcastDocumentCreated,
  broadcastDocumentDeleted,
  broadcastDocumentTrashed,
  clearLocalDocumentTrash,
  markLocalDocumentTrash,
} from "~/hooks/use-document-meta-sync";
import { useKnownDocumentName } from "~/hooks/use-known-document-name";
import {
  clearNewDocumentFlag,
  isDocumentNew,
} from "~/hooks/use-new-document-flag";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

type RestoreDocumentOptions = {
  openDocument?: boolean;
  /** When false, the caller reveals the doc in the sidebar after success UI. */
  updateList?: boolean;
  /** Toast on success. Default true when not navigating to the document. */
  notify?: boolean;
};

export function useRestoreDocument() {
  const router = useRouter();
  const utils = api.useUtils();
  const { toast } = useToast();
  const restoreMutation = api.document.restoreDocument.useMutation();

  const revealInList = useCallback(
    (id: string, name: string) => {
      clearLocalDocumentTrash(id);
      applyDocumentCreated(utils, id, name);
      broadcastDocumentCreated(id, name);
    },
    [utils],
  );

  const restore = useCallback(
    async (id: string, name: string, options?: RestoreDocumentOptions) => {
      try {
        await restoreMutation.mutateAsync({ id });
        if (options?.updateList !== false) {
          revealInList(id, name);
        }
        if (options?.openDocument === false) {
          if (options.notify !== false) {
            toast({ title: "Document restored" });
          }
        } else {
          router.push(`/documents/${id}`);
        }
        return true;
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Could not restore document",
          description: getErrorMessage(err),
        });
        return false;
      }
    },
    [restoreMutation, revealInList, router, toast],
  );

  return { restore, revealInList };
}

function isPersistedDocument(id: string): boolean {
  const live = useCollaborativeDocStore.getState();
  if (live.documentId === id) {
    return live.isPersisted || !isDocumentNew(id);
  }
  return !isDocumentNew(id);
}

export function useTrashDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const { toast } = useToast();
  const isOffline = useBrowserOffline();
  const routeDocumentId = useRouteDocumentId() ?? "";
  const knownName = useKnownDocumentName(routeDocumentId);
  const resetForNavigation = useDocumentPublishStore(
    (s) => s.resetForNavigation,
  );
  const [isPending, setIsPending] = useState(false);

  const trashMutation = api.document.trashDocument.useMutation();
  const { restore } = useRestoreDocument();

  const trashDocument = useCallback(
    async (id: string, name: string) => {
      if (!id || isOffline || isPending) return;

      const trimmedName = name.trim();
      const resolvedName = trimmedName.length > 0 ? trimmedName : "Untitled";
      const persisted = isPersistedDocument(id);
      const list =
        utils.document.getDocumentIdsForAuthenticatedUser.getData()
          ?.documents ?? [];
      const next = list.find((doc) => doc.id !== id);
      const isViewing = pathname === `/documents/${id}`;

      setIsPending(true);
      if (isViewing) {
        resetForNavigation();
      }
      markLocalDocumentTrash(id);
      if (persisted) {
        applyDocumentMovedToTrash(utils, id, resolvedName);
        broadcastDocumentTrashed(id, resolvedName);
      } else {
        applyDocumentDeleted(utils, id);
        broadcastDocumentDeleted(id);
      }
      clearNewDocumentFlag(id);

      if (isViewing) {
        router.replace(next ? `/documents/${next.id}` : "/documents");
      }

      try {
        if (persisted) {
          await trashMutation.mutateAsync({ id });
          toast({
            title: "Moved to trash",
            duration: 8000,
            action: (
              <ToastAction
                altText="Undo"
                onClick={() => {
                  void restore(id, resolvedName);
                }}
              >
                Undo
              </ToastAction>
            ),
          });
        }
      } catch (err) {
        clearLocalDocumentTrash(id);
        applyDocumentCreated(utils, id, resolvedName);
        broadcastDocumentCreated(id, resolvedName);
        toast({
          variant: "destructive",
          title: "Could not move document to trash",
          description: getErrorMessage(err),
        });
      } finally {
        setIsPending(false);
      }
    },
    [
      isOffline,
      isPending,
      pathname,
      resetForNavigation,
      restore,
      router,
      toast,
      trashMutation,
      utils,
    ],
  );

  const trashCurrent = useCallback(async () => {
    const trimmedName = knownName?.trim();
    await trashDocument(
      routeDocumentId,
      trimmedName && trimmedName.length > 0 ? trimmedName : "Untitled",
    );
  }, [knownName, routeDocumentId, trashDocument]);

  return {
    trashDocument,
    trashCurrent,
    isPending,
    isOffline,
  };
}
