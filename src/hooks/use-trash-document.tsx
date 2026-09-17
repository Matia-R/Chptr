"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useDocumentIsPersisted } from "~/app/_components/editor/collaborative-doc-store";
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
  useNewDocumentFlag,
} from "~/hooks/use-new-document-flag";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

export function useRestoreDocument() {
  const router = useRouter();
  const utils = api.useUtils();
  const { toast } = useToast();
  const restoreMutation = api.document.restoreDocument.useMutation();

  const restore = useCallback(
    async (
      id: string,
      name: string,
      options?: { openDocument?: boolean },
    ) => {
      try {
        await restoreMutation.mutateAsync({ id });
        clearLocalDocumentTrash(id);
        applyDocumentCreated(utils, id, name);
        broadcastDocumentCreated(id, name);
        if (options?.openDocument === false) {
          toast({ title: "Document restored" });
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
    [restoreMutation, router, toast, utils],
  );

  return { restore };
}

export function useTrashDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const { toast } = useToast();
  const isOffline = useBrowserOffline();
  const documentId = useRouteDocumentId() ?? "";
  const { isNew } = useNewDocumentFlag();
  const isPersisted = useDocumentIsPersisted(documentId);
  const knownName = useKnownDocumentName(documentId);
  const closeBothPanels = useDocumentPublishStore((s) => s.closeBothPanels);
  const [isPending, setIsPending] = useState(false);

  const trashMutation = api.document.trashDocument.useMutation();
  const { restore } = useRestoreDocument();

  const trashCurrent = useCallback(async () => {
    if (!documentId || isOffline || isPending) return;

    const trimmedName = knownName?.trim();
    const name = trimmedName && trimmedName.length > 0 ? trimmedName : "Untitled";
    const persisted = !isNew || isPersisted;
    const list =
      utils.document.getDocumentIdsForAuthenticatedUser.getData()?.documents ??
      [];
    const next = list.find((doc) => doc.id !== documentId);

    setIsPending(true);
    closeBothPanels();
    markLocalDocumentTrash(documentId);
    if (persisted) {
      applyDocumentMovedToTrash(utils, documentId, name);
      broadcastDocumentTrashed(documentId, name);
    } else {
      applyDocumentDeleted(utils, documentId);
      broadcastDocumentDeleted(documentId);
    }
    clearNewDocumentFlag(documentId);

    if (pathname === `/documents/${documentId}`) {
      router.replace(next ? `/documents/${next.id}` : "/documents");
    }

    try {
      if (persisted) {
        await trashMutation.mutateAsync({ id: documentId });
      }

      if (persisted) {
        toast({
          title: "Moved to trash",
          duration: 8000,
          action: (
            <ToastAction
              altText="Undo"
              onClick={() => {
                void restore(documentId, name);
              }}
            >
              Undo
            </ToastAction>
          ),
        });
      }
    } catch (err) {
      clearLocalDocumentTrash(documentId);
      applyDocumentCreated(utils, documentId, name);
      broadcastDocumentCreated(documentId, name);
      toast({
        variant: "destructive",
        title: "Could not move document to trash",
        description: getErrorMessage(err),
      });
    } finally {
      setIsPending(false);
    }
  }, [
    closeBothPanels,
    documentId,
    isNew,
    isOffline,
    isPending,
    isPersisted,
    knownName,
    pathname,
    restore,
    router,
    toast,
    trashMutation,
    utils,
  ]);

  return {
    trashCurrent,
    isPending,
    isOffline,
  };
}
