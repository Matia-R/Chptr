import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { throttle } from "lodash";

interface UseCollaborativeDocOptions {
  documentId: string;
  snapshotData?: { success: boolean; snapshot: string | null } | undefined;
  onSnapshotPersist: (snapshotData: string) => void;
}

interface UseCollaborativeDocResult {
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  isReady: boolean;
}

/* -------------------------------- Helpers -------------------------------- */

/**
 * Decodes a base64 string to Uint8Array for Yjs.
 * The database layer now guarantees we always receive base64.
 */
function decodeBase64Snapshot(snapshot: string): Uint8Array {
  const trimmed = snapshot.trim();
  
  if (trimmed.length === 0) {
    throw new Error('Snapshot is empty or whitespace');
  }
  
  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(trimmed)) {
    throw new Error(`Invalid base64 snapshot: contains invalid characters. Preview: ${trimmed.substring(0, 50)}`);
  }
  
  // Decode base64 to binary string
  let binary: string;
  try {
    binary = atob(trimmed);
  } catch (err) {
    throw new Error(
      `Failed to decode base64 snapshot: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes;
}

function applyBase64Snapshot(ydoc: Y.Doc, snapshot: string) {
  const bytes = decodeBase64Snapshot(snapshot);
  Y.applyUpdate(ydoc, bytes);
}

/* ---------------------------------- Hook ---------------------------------- */

export function useCollaborativeDoc({
  documentId,
  snapshotData,
  onSnapshotPersist,
}: UseCollaborativeDocOptions): UseCollaborativeDocResult {
  const [state, setState] = useState<{
    ydoc: Y.Doc;
    provider: WebrtcProvider;
  } | null>(null);

  const [isReady, setIsReady] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const isLeaderRef = useRef(false);

  const persistRef = useRef(onSnapshotPersist);
  useEffect(() => {
    persistRef.current = onSnapshotPersist;
  }, [onSnapshotPersist]);

  const throttledPersistRef =
    useRef<ReturnType<typeof throttle<() => void>> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setup = () => {
      // Cleanup any previous session
      cleanupRef.current?.();
      cleanupRef.current = null;

      /* ---------------- Create doc ---------------- */

      const ydoc = new Y.Doc();

      /* -------- APPLY SNAPSHOT BEFORE PROVIDER -------- */

      if (snapshotData?.success && snapshotData.snapshot !== null && snapshotData.snapshot !== undefined) {
        try {
          if (typeof snapshotData.snapshot !== 'string') {
            console.warn('[useCollaborativeDoc] Snapshot data is not a string, skipping');
          } else {
            applyBase64Snapshot(ydoc, snapshotData.snapshot);
          }
        } catch (err) {
          console.error("[useCollaborativeDoc] Failed to apply snapshot:", err);
          // Continue without snapshot - document will start fresh
        }
      }

      /* ---------------- Create provider ---------------- */

      const provider = new WebrtcProvider(documentId, ydoc);

      if (cancelled) {
        provider.destroy();
        ydoc.destroy();
        return;
      }

      setState({ ydoc, provider });
      setIsReady(true);

      /* ---------------- Leader election ---------------- */

      const calculateLeader = () => {
        const ids = Array.from(
          provider.awareness.getStates().keys()
        );

        if (!ids.length) {
          isLeaderRef.current = false;
          return;
        }

        const leaderId = Math.min(...ids);
        isLeaderRef.current =
          provider.awareness.clientID === leaderId;
      };

      provider.on("peers", calculateLeader);
      provider.awareness.on("change", calculateLeader);
      calculateLeader();

      /* ---------------- Snapshot persistence ---------------- */

      throttledPersistRef.current = throttle(
        () => {
          const update = Y.encodeStateAsUpdate(ydoc);
      
          // Convert Uint8Array → binary string → base64
          let binary = "";
          for (const byte of update) {
            binary += String.fromCharCode(byte);
          }
      
          const base64 = btoa(binary);
      
          persistRef.current(base64);
        },
        5000,
        { leading: false, trailing: true }
      );
      

      const onUpdate = (_: Uint8Array, origin: unknown) => {
        // Persist only local edits from leader
        if (origin === provider || !isLeaderRef.current) return;
        throttledPersistRef.current?.();
      };

      ydoc.on("update", onUpdate);

      /* ---------------- Cleanup ---------------- */

      cleanupRef.current = () => {
        provider.off("peers", calculateLeader);
        provider.awareness.off("change", calculateLeader);
        ydoc.off("update", onUpdate);

        throttledPersistRef.current?.cancel();
        throttledPersistRef.current = null;

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

    if (snapshotData !== undefined) {
      setup();
    }

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [documentId, snapshotData]);

  return {
    ydoc: state?.ydoc ?? null,
    provider: state?.provider ?? null,
    isReady,
  };
}