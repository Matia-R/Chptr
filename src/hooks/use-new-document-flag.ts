"use client";

import { useParams } from "next/navigation";
import { useRef, useCallback } from "react";

/**
 * In-memory store for tracking "new" document IDs.
 * 
 * This is intentionally in-memory only:
 * - Can't be manipulated by users via URL
 * - Doesn't transfer when copying/sharing URLs (new tab = fresh memory)
 * - If user refreshes, it's cleared → fetches from DB (correct behavior)
 */
const newDocumentIds = new Set<string>();

/**
 * Mark a document ID as "new" (call before navigating to the new document)
 */
export function markDocumentAsNew(documentId: string) {
  newDocumentIds.add(documentId);
}

/**
 * Remove a document ID from the "new" set (call after successful persistence)
 */
export function clearNewDocumentFlag(documentId: string) {
  newDocumentIds.delete(documentId);
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
 * This hook freezes the "isNew" state per documentId to prevent re-renders
 * when the flag is cleared. The frozen state is reset when documentId changes.
 * 
 * @returns {Object} { isNew, clearFlag }
 */
export function useNewDocumentFlag() {
  const params = useParams();
  const documentId = params.documentId as string;
  
  // Track which documentId we've frozen the isNew state for
  const frozenStateRef = useRef<{ documentId: string; isNew: boolean } | null>(null);
  
  // Reset frozen state when documentId changes, or initialize it
  if (!frozenStateRef.current || frozenStateRef.current.documentId !== documentId) {
    frozenStateRef.current = {
      documentId,
      isNew: newDocumentIds.has(documentId),
    };
  }
  
  const isNew = frozenStateRef.current.isNew;
  
  // Clear the flag (call on first successful persistence)
  const clearFlag = useCallback(() => {
    if (documentId) {
      clearNewDocumentFlag(documentId);
      // Note: we don't update frozenStateRef here intentionally
      // The frozen state stays true until navigation to prevent flicker
    }
  }, [documentId]);
  
  return {
    isNew,
    clearFlag,
  };
}
