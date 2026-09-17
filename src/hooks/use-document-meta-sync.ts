"use client";

import { useEffect } from "react";
import { api } from "~/trpc/react";

const CHANNEL = "chptr-document-meta";

export const DOCUMENT_META_CHANNEL = CHANNEL;

/** Ids trashed in this tab, so the live editor does not flash “not found”. */
const localTrashIds = new Set<string>();

export function markLocalDocumentTrash(documentId: string) {
  localTrashIds.add(documentId);
}

export function clearLocalDocumentTrash(documentId: string) {
  localTrashIds.delete(documentId);
}

export function isLocalDocumentTrash(documentId: string) {
  return localTrashIds.has(documentId);
}

export type DocumentMetaMessage =
  | { type: "name"; documentId: string; name: string }
  | { type: "created"; documentId: string; name: string }
  | { type: "deleted"; documentId: string }
  | { type: "trashed"; documentId: string; name: string };

type TrpcUtils = ReturnType<typeof api.useUtils>;

export function applyDocumentName(
  utils: TrpcUtils,
  documentId: string,
  name: string,
) {
  utils.document.getDocumentById.setData(documentId, (old) => {
    if (!old?.document) return old;
    return {
      ...old,
      document: { ...old.document, name },
    };
  });

  utils.document.getDocumentIdsForAuthenticatedUser.setData(
    undefined,
    (old) => {
      if (!old?.documents) {
        return { success: true, documents: [{ id: documentId, name }] };
      }
      const exists = old.documents.some((doc) => doc.id === documentId);
      if (exists) {
        return {
          ...old,
          documents: old.documents.map((doc) =>
            doc.id === documentId ? { ...doc, name } : doc,
          ),
        };
      }
      return {
        ...old,
        documents: [{ id: documentId, name }, ...old.documents],
      };
    },
  );
}

export function applyDocumentCreated(
  utils: TrpcUtils,
  documentId: string,
  name: string,
) {
  utils.document.getDocumentIdsForAuthenticatedUser.setData(
    undefined,
    (old) => {
      if (!old?.documents) {
        return { success: true, documents: [{ id: documentId, name }] };
      }
      if (old.documents.some((doc) => doc.id === documentId)) return old;
      return {
        ...old,
        documents: [{ id: documentId, name }, ...old.documents],
      };
    },
  );
  utils.document.getTrashedDocuments.setData(undefined, (old) => {
    if (!old?.documents) return old;
    return {
      ...old,
      documents: old.documents.filter((doc) => doc.id !== documentId),
    };
  });
}

export function applyDocumentDeleted(utils: TrpcUtils, documentId: string) {
  utils.document.getDocumentIdsForAuthenticatedUser.setData(
    undefined,
    (old) => {
      if (!old?.documents) return old;
      return {
        ...old,
        documents: old.documents.filter((doc) => doc.id !== documentId),
      };
    },
  );
  utils.document.getDocumentById.setData(documentId, undefined);
  utils.document.getDocumentState.setData(documentId, undefined);
  utils.document.getPublicationByDocumentId.setData(documentId, null);
}

export function applyDocumentMovedToTrash(
  utils: TrpcUtils,
  documentId: string,
  name: string,
  deletedAt = new Date().toISOString(),
) {
  applyDocumentDeleted(utils, documentId);
  utils.document.getTrashedDocuments.setData(undefined, (old) => {
    const documents = old?.documents ?? [];
    if (documents.some((doc) => doc.id === documentId)) {
      return old ?? { success: true, documents };
    }
    return {
      success: true,
      documents: [{ id: documentId, name, deletedAt }, ...documents],
    };
  });
}

function postDocumentMeta(message: DocumentMetaMessage) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(message);
  channel.close();
}

export function broadcastDocumentName(documentId: string, name: string) {
  postDocumentMeta({ type: "name", documentId, name });
}

export function broadcastDocumentCreated(documentId: string, name: string) {
  postDocumentMeta({ type: "created", documentId, name });
}

export function broadcastDocumentDeleted(documentId: string) {
  postDocumentMeta({ type: "deleted", documentId });
}

export function broadcastDocumentTrashed(documentId: string, name: string) {
  postDocumentMeta({ type: "trashed", documentId, name });
}

/** Keep the document list / title cache in sync across same-origin tabs. */
export function useDocumentMetaSync() {
  const utils = api.useUtils();

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<DocumentMetaMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "name") {
        applyDocumentName(utils, msg.documentId, msg.name);
      } else if (msg.type === "created") {
        applyDocumentCreated(utils, msg.documentId, msg.name);
      } else if (msg.type === "deleted") {
        applyDocumentDeleted(utils, msg.documentId);
      } else if (msg.type === "trashed") {
        applyDocumentMovedToTrash(utils, msg.documentId, msg.name);
      }
    };
    return () => channel.close();
  }, [utils]);
}
