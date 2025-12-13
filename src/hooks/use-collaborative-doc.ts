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

function hexToBytes(hex: string): Uint8Array {
  let cleanHex = hex;
  
  // Remove \x or 0x prefix if present (checking for literal backslash-x or 0x)
  if (hex.startsWith('\\x')) {
    cleanHex = hex.slice(2); // Remove \x prefix (2 characters: backslash and x)
  } else if (hex.startsWith('0x') || hex.startsWith('0X')) {
    cleanHex = hex.slice(2); // Remove 0x prefix
  }
  
  // Remove any whitespace
  const trimmedHex = cleanHex.replace(/\s/g, '');
  
  // Validate hex string (must be even length and only hex digits)
  if (trimmedHex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: length must be even, got ${trimmedHex.length}`);
  }
  
  if (!/^[0-9a-fA-F]+$/.test(trimmedHex)) {
    throw new Error('Invalid hex string: contains non-hexadecimal characters');
  }
  
  const bytes = new Uint8Array(trimmedHex.length / 2);
  for (let i = 0; i < trimmedHex.length; i += 2) {
    bytes[i / 2] = parseInt(trimmedHex.substring(i, i + 2), 16);
  }
  
  return bytes;
}

function validateAndDecodeSnapshot(snapshot: unknown): Uint8Array {
  console.log('[validateAndDecodeSnapshot] Starting validation, input type:', typeof snapshot);
  
  // Type check
  if (typeof snapshot !== 'string') {
    const type = typeof snapshot;
    const preview = String(snapshot).substring(0, 50);
    console.error('[validateAndDecodeSnapshot] Type check failed:', { type, preview });
    throw new Error(
      `Invalid snapshot: expected string, got ${type}. Preview: ${preview}`
    );
  }
  
  console.log('[validateAndDecodeSnapshot] Input is string, length:', snapshot.length);
  
  // Empty check
  const trimmed = snapshot.trim();
  if (trimmed.length === 0) {
    console.error('[validateAndDecodeSnapshot] Empty string after trim');
    throw new Error('Invalid snapshot: snapshot is empty or whitespace');
  }
  
  console.log('[validateAndDecodeSnapshot] After trim, length:', trimmed.length);
  console.log('[validateAndDecodeSnapshot] Preview:', trimmed.substring(0, 100));
  
  // Check if it explicitly starts with hex prefix (definitely hex)
  const hasHexPrefix = trimmed.startsWith('\\x') || 
                       trimmed.startsWith('0x') || 
                       trimmed.startsWith('0X');
  
  // Check if it's base64 (contains base64-specific characters or valid base64 pattern)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  const hasBase64Chars = /[+/=]/.test(trimmed); // Base64-specific characters
  const isBase64 = base64Regex.test(trimmed);
  
  // Check if it's pure hex (only hex digits, no base64 chars)
  const isPureHex = /^[0-9a-fA-F]+$/.test(trimmed);
  
  console.log('[validateAndDecodeSnapshot] Format detection:', { 
    hasHexPrefix, 
    hasBase64Chars, 
    isBase64, 
    isPureHex 
  });
  
  // Priority: hex prefix > base64 (if has base64 chars) > pure hex
  if (hasHexPrefix || (isPureHex && !hasBase64Chars && !isBase64)) {
    // It's a hex string, decode as hex
    console.log('[validateAndDecodeSnapshot] Detected hex format, decoding...');
    try {
      const hexBytes = hexToBytes(trimmed);
      console.log('[validateAndDecodeSnapshot] Hex decode successful, bytes length:', hexBytes.length);
      
      // Check if the hex-decoded bytes are actually a base64 string
      // Convert bytes to string to check
      let decodedString = '';
      for (const byte of hexBytes) {
        decodedString += String.fromCharCode(byte);
      }
      
      console.log('[validateAndDecodeSnapshot] Hex-decoded string preview:', decodedString.substring(0, 100));
      
      // Check if it looks like base64 (contains base64 chars and is valid base64)
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (base64Regex.test(decodedString)) {
        console.log('[validateAndDecodeSnapshot] Hex-decoded string is base64, decoding base64...');
        // It's hex-encoded base64, decode the base64 to get the actual binary
        const binary = atob(decodedString);
        const finalBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          finalBytes[i] = binary.charCodeAt(i);
        }
        console.log('[validateAndDecodeSnapshot] Base64 decode successful, final bytes length:', finalBytes.length);
        return finalBytes;
      } else {
        // It's raw hex-encoded binary, return as-is
        console.log('[validateAndDecodeSnapshot] Hex-decoded bytes are raw binary, using directly');
        return hexBytes;
      }
    } catch (err) {
      console.error('[validateAndDecodeSnapshot] Hex decode failed:', {
        error: err,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Invalid hex snapshot: failed to decode hex string. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else if (isBase64) {
    // It's base64, decode as base64
    console.log('[validateAndDecodeSnapshot] Detected base64 format, decoding...');
    try {
      const binary = atob(trimmed);
      console.log('[validateAndDecodeSnapshot] Base64 decode successful, binary length:', binary.length);
      
      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      console.log('[validateAndDecodeSnapshot] Conversion to Uint8Array complete, length:', bytes.length);
      return bytes;
    } catch (err) {
      console.error('[validateAndDecodeSnapshot] Base64 decode failed:', {
        error: err,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Invalid base64 snapshot: failed to decode base64 string. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    // Unknown format
    const invalidChars = trimmed.split('').filter(c => !/[A-Za-z0-9+/=\\x]/.test(c));
    console.error('[validateAndDecodeSnapshot] Unknown format:', {
      preview: trimmed.substring(0, 100),
      invalidChars: invalidChars.slice(0, 10),
    });
    throw new Error(
      `Invalid snapshot: string is neither valid base64 nor valid hex. ` +
      `Preview: ${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}`
    );
  }
}

function applyBase64Snapshot(ydoc: Y.Doc, snapshot: unknown) {
  const bytes = validateAndDecodeSnapshot(snapshot);
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

      console.log('[useCollaborativeDoc] Snapshot data received:', {
        hasSnapshotData: snapshotData !== undefined,
        success: snapshotData?.success,
        snapshotType: typeof snapshotData?.snapshot,
        snapshotIsNull: snapshotData?.snapshot === null,
        snapshotIsUndefined: snapshotData?.snapshot === undefined,
        snapshotLength: typeof snapshotData?.snapshot === 'string' ? snapshotData.snapshot.length : 'N/A',
        snapshotPreview: typeof snapshotData?.snapshot === 'string' 
          ? snapshotData.snapshot.substring(0, 100) 
          : String(snapshotData?.snapshot).substring(0, 100),
      });

      if (snapshotData?.success && snapshotData.snapshot !== null && snapshotData.snapshot !== undefined) {
        console.log('[useCollaborativeDoc] Attempting to apply snapshot...');
        try {
          // Additional type check before applying
          if (typeof snapshotData.snapshot !== 'string') {
            console.warn(
              `[useCollaborativeDoc] Snapshot data is not a string. Type: ${typeof snapshotData.snapshot}, Value:`,
              snapshotData.snapshot
            );
            // Skip applying snapshot
          } else {
            console.log('[useCollaborativeDoc] Calling applyBase64Snapshot with string length:', snapshotData.snapshot.length);
            applyBase64Snapshot(ydoc, snapshotData.snapshot);
            console.log('[useCollaborativeDoc] Snapshot applied successfully');
          }
        } catch (err) {
          console.error("[useCollaborativeDoc] Failed to apply snapshot:", err);
          if (err instanceof Error) {
            console.error("[useCollaborativeDoc] Error details:", {
              message: err.message,
              stack: err.stack,
              name: err.name,
            });
          }
          // Continue without snapshot - document will start fresh
        }
      } else {
        console.log('[useCollaborativeDoc] Skipping snapshot application - no valid snapshot data');
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