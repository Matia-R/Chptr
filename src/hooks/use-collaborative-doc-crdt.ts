"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { api } from "~/trpc/react";

interface UseCollaborativeDocCrdtOptions {
  documentId: string;
  /** If true, skip fetching and start with empty doc (for new documents) */
  isNew?: boolean;
}

interface UseCollaborativeDocCrdtResult {
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
}

/* -------------------------------- Helpers -------------------------------- */

function generateClientId(): string {
  return crypto.randomUUID();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/* ---------------------------------- Hook ---------------------------------- */

export function useCollaborativeDocCrdt({
  documentId,
  isNew = false,
}: UseCollaborativeDocCrdtOptions): UseCollaborativeDocCrdtResult {
  const [state, setState] = useState<{
    ydoc: Y.Doc;
    provider: WebrtcProvider;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup and tracking
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastDocumentIdRef = useRef<string | null>(null);
  const clientIdRef = useRef<string>(generateClientId());
  const clockRef = useRef<number>(0);
  const pendingChangesRef = useRef<Array<{ clientId: string; clock: number; updateData: string }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef(documentId);

  // Keep documentId ref updated
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  // tRPC utils
  const utils = api.useUtils();

  // Invalidate cache when documentId changes to ensure fresh data
  useEffect(() => {
    if (lastDocumentIdRef.current !== null && lastDocumentIdRef.current !== documentId) {
      // Navigating to a different document - invalidate cache to get fresh data
      void utils.document.getDocumentChanges.invalidate(documentId);
    }
  }, [documentId, utils.document.getDocumentChanges]);

  // Mutation for batch saving changes
  const saveChangesMutation = api.document.saveDocumentChanges.useMutation({
    onError: (err) => {
      console.error("[CRDT] Failed to save changes:", err);
    },
    onSuccess: () => {
      void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
    },
  });
  const mutateRef = useRef(saveChangesMutation.mutate);
  useEffect(() => {
    mutateRef.current = saveChangesMutation.mutate;
  }, [saveChangesMutation.mutate]);

  // Fetch existing changes for the document
  const {
    data: changesData,
    isLoading: isChangesLoading,
    error: changesError,
    isSuccess: changesSuccess,
    dataUpdatedAt,
  } = api.document.getDocumentChanges.useQuery(documentId, {
    enabled: !!documentId && !isNew,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on error; show error and stop
    staleTime: 0,
  });

  // Track if we've initialized for a specific documentId + dataUpdatedAt combination
  const initializedForRef = useRef<string | null>(null);
  // Once we have an error for a document, don't run setup() until documentId changes (sticky error)
  const errorDocumentIdRef = useRef<string | null>(null);

  // Clear error when navigating to a different document so the new document gets a clean slate
  const prevDocumentIdRef = useRef<string>(documentId);
  useEffect(() => {
    if (prevDocumentIdRef.current !== documentId) {
      prevDocumentIdRef.current = documentId;
      errorDocumentIdRef.current = null;
      setError(null);
    }
  }, [documentId]);

  // Main setup effect
  useEffect(() => {
    let cancelled = false;

    // For existing documents: if the query failed, set error and stop. Never run setup() for this document.
    if (!isNew && changesError) {
      const wrapped = new Error(changesError.message) as Error & { cause?: unknown };
      wrapped.cause = changesError;
      setError(wrapped);
      errorDocumentIdRef.current = documentId;
      return;
    }

    // If we previously set an error for this documentId, don't run setup (e.g. after refetch)
    if (errorDocumentIdRef.current === documentId) {
      return;
    }

    // For new documents, initialize immediately. For existing, wait for query success.
    if (!isNew && !changesSuccess) {
      return;
    }

    const initKey = isNew ? `new-${documentId}` : `${documentId}-${dataUpdatedAt}`;

    if (initializedForRef.current === initKey) {
      return;
    }

    const setup = () => {
      // Cleanup any previous session
      cleanupRef.current?.();
      cleanupRef.current = null;

      setError(null);

      // Reset clock and clientId for new document
      if (lastDocumentIdRef.current !== documentId) {
        clockRef.current = 0;
        clientIdRef.current = generateClientId();
        pendingChangesRef.current = [];
      }

      const ydoc = new Y.Doc();

      // Apply all changes from DB
      const changes = changesData?.changes ?? [];
      if (!isNew && changes.length > 0) {
        console.log(`[CRDT] Applying ${changes.length} changes from database`);
        for (const change of changes) {
          try {
            const update = base64ToUint8Array(change.updateData);
            Y.applyUpdate(ydoc, update);
          } catch (err) {
            console.error("[CRDT] Failed to apply change:", err);
          }
        }
      }

      const provider = new WebrtcProvider(documentId, ydoc);

      if (cancelled) {
        provider.destroy();
        ydoc.destroy();
        return;
      }

      lastDocumentIdRef.current = documentId;
      initializedForRef.current = initKey;
      setState({ ydoc, provider });
      setIsReady(true);

      // Flush function
      const flushChanges = () => {
        if (pendingChangesRef.current.length === 0) return;
        const changes = [...pendingChangesRef.current];
        pendingChangesRef.current = [];
        console.log(`[CRDT] Flushing ${changes.length} changes to server`);
        mutateRef.current({
          documentId: documentIdRef.current,
          changes,
        });
      };

      // Queue update function
      const queueUpdate = (update: Uint8Array) => {
        clockRef.current += 1;
        pendingChangesRef.current.push({
          clientId: clientIdRef.current,
          clock: clockRef.current,
          updateData: uint8ArrayToBase64(update),
        });
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
        }
        flushTimeoutRef.current = setTimeout(flushChanges, 500);
      };

      const onUpdate = (update: Uint8Array, _origin: unknown) => {
        queueUpdate(update);
      };

      ydoc.on("update", onUpdate);

      cleanupRef.current = () => {
        ydoc.off("update", onUpdate);
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        if (pendingChangesRef.current.length > 0) {
          flushChanges();
        }
        try { provider.destroy(); } catch {}
        try { ydoc.destroy(); } catch {}
        setState(null);
        setIsReady(false);
      };
    };

    setup();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // dataUpdatedAt ensures we re-run when fresh data arrives after navigation
  }, [documentId, isNew, changesSuccess, changesError, changesData, dataUpdatedAt]);

  return {
    ydoc: state?.ydoc ?? null,
    provider: state?.provider ?? null,
    isReady,
    isLoading: !isNew && isChangesLoading,
    error,
  };
}
