"use client";

import { useParams } from "next/navigation";
import { useRef, useCallback, useSyncExternalStore } from "react";

/**
 * In-memory store for tracking "new" document IDs.
 * 
 * This is intentionally in-memory only:
 * - Can't be manipulated by users via URL
 * - Doesn't transfer when copying/sharing URLs (new tab = fresh memory)
 * - If user refreshes, it's cleared → fetches from DB (correct behavior)
 */
const newDocumentIds = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return newDocumentIds;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Mark a document ID as "new" (call before navigating to the new document)
 */
export function markDocumentAsNew(documentId: string) {
  newDocumentIds.add(documentId);
  notifyListeners();
}

/**
 * Remove a document ID from the "new" set (call after successful persistence)
 */
export function clearNewDocumentFlag(documentId: string) {
  newDocumentIds.delete(documentId);
  notifyListeners();
}

/**
 * Check if a document ID is marked as "new"
 */
export function isDocumentNew(documentId: string): boolean {
  return newDocumentIds.has(documentId);
}

/**
 * Hook to check if the current document is "new" and get a cleanup function.
 * 
 * - Returns frozen state to prevent re-renders during cleanup
 * - Provides clearFlag function to call on first successful persistence
 * 
 * @returns {Object} { isNew, clearFlag }
 */
export function useNewDocumentFlag() {
  const params = useParams();
  const documentId = params.documentId as string;
  
  // Subscribe to store changes (needed for useSyncExternalStore)
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  
  // Freeze the initial isNew value on first render
  // This prevents re-renders when we clear the flag
  const isNewRef = useRef<boolean | null>(null);
  if (isNewRef.current === null) {
    isNewRef.current = store.has(documentId);
  }
  
  // Clear the flag (call on first successful persistence)
  const clearFlag = useCallback(() => {
    if (isNewRef.current && documentId) {
      clearNewDocumentFlag(documentId);
    }
  }, [documentId]);
  
  return {
    isNew: isNewRef.current,
    clearFlag,
  };
}
