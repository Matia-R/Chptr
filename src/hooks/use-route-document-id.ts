"use client";

import { useParams, usePathname } from "next/navigation";

/**
 * Document id for the current URL.
 *
 * The publish button lives in `documents/layout`. `useParams()` there can
 * stay on the previous `[documentId]` for a frame after the URL has already
 * changed. `usePathname()` follows the location immediately.
 */
export function useRouteDocumentId(): string | undefined {
  const pathname = usePathname();
  const params = useParams();
  const fromPath = /^\/documents\/([^/]+)$/.exec(pathname)?.[1];
  if (fromPath) return fromPath;
  const fromParams = params.documentId;
  return typeof fromParams === "string" ? fromParams : undefined;
}
