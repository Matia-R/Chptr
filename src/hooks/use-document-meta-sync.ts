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

type DocumentListCache = {
  documents: { id: string; name: string }[];
  trashedDocuments: { id: string; name: string; deletedAt: string }[];
};

function patchDocumentList(
  utils: TrpcUtils,
  patch: (old: DocumentListCache) => DocumentListCache,
) {
  utils.document.getDocumentIdsForAuthenticatedUser.setData(
    undefined,
    (old: Partial<DocumentListCache> | undefined) => {
      const next = patch({
        documents: old?.documents ?? [],
        trashedDocuments: old?.trashedDocuments ?? [],
      });
      return { success: true as const, ...next };
    },
  );
}

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

  patchDocumentList(utils, ({ documents, trashedDocuments }) => {
    const inList = documents.some((doc) => doc.id === documentId);
    const inTrash = trashedDocuments.some((doc) => doc.id === documentId);
    return {
      documents: inList
        ? documents.map((doc) =>
            doc.id === documentId ? { ...doc, name } : doc,
          )
        : inTrash
          ? documents
          : [{ id: documentId, name }, ...documents],
      trashedDocuments: trashedDocuments.map((doc) =>
        doc.id === documentId ? { ...doc, name } : doc,
      ),
    };
  });
}

export function applyDocumentCreated(
  utils: TrpcUtils,
  documentId: string,
  name: string,
) {
  clearLocalDocumentTrash(documentId);
  // Trash deletes the snapshot; don't keep a stale "Live" publication for 30s.
  utils.document.getPublicationByDocumentId.setData(documentId, null);
  patchDocumentList(utils, ({ documents, trashedDocuments }) => ({
    documents: documents.some((doc) => doc.id === documentId)
      ? documents
      : [{ id: documentId, name }, ...documents],
    trashedDocuments: trashedDocuments.filter((doc) => doc.id !== documentId),
  }));
}

export function applyDocumentDeleted(utils: TrpcUtils, documentId: string) {
  patchDocumentList(utils, ({ documents, trashedDocuments }) => ({
    documents: documents.filter((doc) => doc.id !== documentId),
    trashedDocuments,
  }));
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
  utils.document.getDocumentById.setData(documentId, undefined);
  utils.document.getDocumentState.setData(documentId, undefined);
  utils.document.getPublicationByDocumentId.setData(documentId, null);
  patchDocumentList(utils, ({ documents, trashedDocuments }) => ({
    documents: documents.filter((doc) => doc.id !== documentId),
    trashedDocuments: trashedDocuments.some((doc) => doc.id === documentId)
      ? trashedDocuments
      : [{ id: documentId, name, deletedAt }, ...trashedDocuments],
  }));
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
