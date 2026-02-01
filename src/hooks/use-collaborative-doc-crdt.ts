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
 * Generate a unique client ID for this hook instance.
 * Each hook initialization gets a new ID to ensure clock values never collide.
 * This is important because after a refresh, the clock resets to 0 but if we
 * reuse the same clientId, new saves would have duplicate (clientId, clock) keys.
 */
function generateClientId(): string {
  return crypto.randomUUID();
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
  // Generate a new clientId for each hook instance
  // This ensures clock values never collide after refresh/navigation
  const clientIdRef = useRef<string>(generateClientId());
  const clockRef = useRef<number>(0);
  const pendingChangesRef = useRef<Array<{ clientId: string; clock: number; updateData: string }>>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef(documentId);
  
  // Ref to capture initial changes data (only used once for initialization)
  const initialChangesRef = useRef<{ clientId: string; clock: number; updateData: string; createdAt: string }[] | null>(null);

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

  // Fetch existing changes for the document (only once on mount)
  const {
    data: changesData,
    isLoading: isChangesLoading,
    error: changesError,
    isSuccess: changesSuccess,
  } = api.document.getDocumentChanges.useQuery(documentId, {
    enabled: !!documentId && !isNew,
    refetchOnMount: false,      // Only fetch once
    refetchOnWindowFocus: false, // Don't refetch on focus
    staleTime: Infinity,        // Never consider stale
  });

  // Capture initial changes data when query succeeds (only once)
  useEffect(() => {
    if (changesSuccess && changesData && initialChangesRef.current === null) {
      initialChangesRef.current = changesData.changes;
    }
  }, [changesSuccess, changesData]);

  // Main setup effect - only run once per documentId
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

      // Use the captured initial changes (from ref, not from query)
      const changes = initialChangesRef.current ?? changesData?.changes ?? [];
      
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
      };
    };

    setup();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // Note: Only depend on documentId, isNew, changesSuccess, changesError
    // NOT changesData - we use initialChangesRef instead to avoid re-runs
  }, [documentId, isNew, changesSuccess, changesError]);

  // Reset when document ID changes
  useEffect(() => {
    if (lastDocumentIdRef.current !== documentId) {
      isInitializedRef.current = false;
      initialChangesRef.current = null; // Reset initial changes for new document
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
