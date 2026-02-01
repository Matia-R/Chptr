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

/**
 * Generate a unique client ID that persists for this browser session.
 * Uses sessionStorage so each tab gets a unique ID.
 */
function getOrCreateClientId(): string {
  const key = "yjs-client-id";
  let clientId = sessionStorage.getItem(key);
  if (!clientId) {
    clientId = crypto.randomUUID();
    sessionStorage.setItem(key, clientId);
  }
  return clientId;
}

/**
 * Decodes a base64 string to Uint8Array for Yjs.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array to base64 string.
 */
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
  const isInitializedRef = useRef(false);
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const clockRef = useRef<number>(0);
  const pendingChangesRef = useRef<Array<{ clientId: string; clock: number; updateData: string }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef(documentId);

  // Keep documentId ref updated
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  // tRPC utils for cache updates
  const utils = api.useUtils();

  // Mutation for batch saving changes - use ref to avoid dependency issues
  const saveChangesMutation = api.document.saveDocumentChanges.useMutation({
    onError: (err) => {
      console.error("[CRDT] Failed to save changes:", err);
    },
    onSuccess: () => {
      // Invalidate sidebar when changes are saved (document may have been created)
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
  } = api.document.getDocumentChanges.useQuery(documentId, {
    enabled: !!documentId && !isNew,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always fetch fresh for CRDT
  });

  // Main setup effect - only depends on stable values
  useEffect(() => {
    let cancelled = false;

    // For new documents, initialize immediately
    // For existing documents, wait for query to complete
    const shouldInitialize = isNew || changesSuccess;

    if (!shouldInitialize) {
      return;
    }

    // Skip if already initialized for this document
    if (isInitializedRef.current && lastDocumentIdRef.current === documentId) {
      return;
    }

    // Handle error
    if (changesError) {
      setError(new Error(changesError.message));
      return;
    }

    const setup = () => {
      // Cleanup any previous session
      cleanupRef.current?.();
      cleanupRef.current = null;

      setError(null);

      /* ---------------- Create doc ---------------- */

      const ydoc = new Y.Doc();

      /* -------- APPLY ALL CHANGES FROM DB -------- */

      if (!isNew && changesData?.changes && changesData.changes.length > 0) {
        console.log(`[CRDT] Applying ${changesData.changes.length} changes from database`);
        
        for (const change of changesData.changes) {
          try {
            const update = base64ToUint8Array(change.updateData);
            Y.applyUpdate(ydoc, update);
          } catch (err) {
            console.error("[CRDT] Failed to apply change:", err);
          }
        }
      }

      /* ---------------- Create provider ---------------- */

      const provider = new WebrtcProvider(documentId, ydoc);

      if (cancelled) {
        provider.destroy();
        ydoc.destroy();
        return;
      }

      // Update refs
      lastDocumentIdRef.current = documentId;
      isInitializedRef.current = true;

      setState({ ydoc, provider });
      setIsReady(true);

      /* ---------------- Save ALL updates (local and remote) ---------------- */

      // Flush function - uses refs to avoid stale closures
      const flushChanges = () => {
        if (pendingChangesRef.current.length === 0) return;

        const changes = [...pendingChangesRef.current];
        pendingChangesRef.current = [];

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

        // Schedule flush with debounce
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
        }
        flushTimeoutRef.current = setTimeout(flushChanges, 500);
      };

      const onUpdate = (update: Uint8Array, _origin: unknown) => {
        // Save every update - both local and remote
        // The unique constraint on (document_id, client_id, clock) prevents duplicates
        queueUpdate(update);
      };

      ydoc.on("update", onUpdate);

      /* ---------------- Cleanup ---------------- */

      cleanupRef.current = () => {
        ydoc.off("update", onUpdate);

        // Flush any pending changes before cleanup
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        if (pendingChangesRef.current.length > 0) {
          flushChanges();
        }

        try {
          provider.destroy();
        } catch {}

        try {
          ydoc.destroy();
        } catch {}

        setState(null);
        setIsReady(false);
        isInitializedRef.current = false;
      };
    };

    setup();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [documentId, isNew, changesSuccess, changesError, changesData]);

  // Reset when document ID changes
  useEffect(() => {
    if (lastDocumentIdRef.current !== documentId) {
      isInitializedRef.current = false;
      clockRef.current = 0;
      pendingChangesRef.current = [];
    }
  }, [documentId]);

  return {
    ydoc: state?.ydoc ?? null,
    provider: state?.provider ?? null,
    isReady,
    isLoading: !isNew && isChangesLoading,
    error,
  };
}
