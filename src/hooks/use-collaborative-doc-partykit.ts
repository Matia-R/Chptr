"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { TRPCClientError } from "@trpc/client";
import {
  DocumentAccessError,
  getDocumentErrorCode,
} from "~/lib/document-access-error";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";

interface UseCollaborativeDocPartykitOptions {
  documentId: string;
  isNew?: boolean;
}

interface UseCollaborativeDocPartykitResult {
  ydoc: Y.Doc | null;
  provider: YPartyKitProvider | null;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
}

const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

const DOCUMENT_STATE_STALE_MS = 30_000;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function applyPrefetchedState(ydoc: Y.Doc, state: string | null) {
  if (!state) return;
  try {
    Y.applyUpdate(ydoc, base64ToUint8Array(state), "prefetch");
  } catch (error) {
    console.error("[PartyKit] Failed to apply prefetched document state:", error);
  }
}

function accessErrorForCloseCode(code: number): DocumentAccessError | null {
  switch (code) {
    case 4000:
      return new DocumentAccessError(
        "BAD_REQUEST",
        "The URL provided is incomplete or malformed."
      );
    case 4001:
      return new DocumentAccessError(
        "UNAUTHORIZED",
        "Please sign in to your account to access this doc."
      );
    case 4003:
      return new DocumentAccessError(
        "FORBIDDEN",
        "Looks like you don't have access to this doc."
      );
    case 4004:
      return new DocumentAccessError("NOT_FOUND", "This doc doesn’t exist.");
    case 4005:
      return new DocumentAccessError(
        "INTERNAL_SERVER_ERROR",
        "A technical issue occurred on our end."
      );
    default:
      return null;
  }
}

function accessErrorFromTrpc(error: unknown): DocumentAccessError | null {
  const code = getDocumentErrorCode(error);
  if (code === "FORBIDDEN") {
    return new DocumentAccessError(
      "FORBIDDEN",
      "Looks like you don't have access to this doc."
    );
  }
  if (code === "NOT_FOUND") {
    return new DocumentAccessError("NOT_FOUND", "This doc doesn’t exist.");
  }
  if (code === "UNAUTHORIZED") {
    return new DocumentAccessError(
      "UNAUTHORIZED",
      "Please sign in to your account to access this doc."
    );
  }
  if (error instanceof TRPCClientError) {
    return null;
  }
  return null;
}

function stopReconnect(provider: YPartyKitProvider) {
  provider.shouldConnect = false;
  try {
    provider.disconnect();
  } catch {
    // Provider may already be closed.
  }
}

export function useCollaborativeDocPartykit({
  documentId,
  isNew = false,
}: UseCollaborativeDocPartykitOptions): UseCollaborativeDocPartykitResult {
  const utils = api.useUtils();
  const [state, setState] = useState<{
    ydoc: Y.Doc;
    provider: YPartyKitProvider;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const lastDocumentIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (lastDocumentIdRef.current === documentId && initializedRef.current) {
      return;
    }

    cleanupRef.current?.();
    cleanupRef.current = null;
    initializedRef.current = false;

    setIsLoading(true);
    setError(null);
    setIsReady(false);

    let cancelled = false;

    const setup = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new DocumentAccessError(
            "INTERNAL_SERVER_ERROR",
            `Failed to get session: ${sessionError.message}`
          );
        }

        if (!session?.access_token) {
          throw new DocumentAccessError(
            "UNAUTHORIZED",
            "Please sign in to your account to access this doc."
          );
        }

        if (cancelled) return;

        const ydoc = new Y.Doc();
        const tokenRef = { current: session.access_token };
        let closedForAuth = false;
        let paintedFromPrefetch = false;

        const markReady = () => {
          if (closedForAuth || cancelled) return;
          setIsReady(true);
          setIsLoading(false);
        };

        const cached = isNew
          ? undefined
          : utils.document.getDocumentState.getData(documentId);
        if (cached !== undefined) {
          applyPrefetchedState(ydoc, cached.state);
          paintedFromPrefetch = true;
        }

        const provider = new YPartyKitProvider(PARTYKIT_HOST, documentId, ydoc, {
          connect: true,
          params: () => ({
            token: tokenRef.current,
            isNew: isNew ? "true" : "false",
          }),
        });

        provider.on("sync", (synced: boolean) => {
          if (synced && !closedForAuth && !isNew) {
            markReady();
          }
        });

        provider.on("connection-error", (err: Error) => {
          if (closedForAuth) return;
          console.error("[PartyKit] Connection error:", err);
          setError(
            err instanceof DocumentAccessError
              ? err
              : new DocumentAccessError(
                  "INTERNAL_SERVER_ERROR",
                  err.message || "Unable to connect to this document"
                )
          );
          setIsLoading(false);
        });

        provider.on("connection-close", (event: CloseEvent) => {
          const accessError = accessErrorForCloseCode(event.code);
          if (!accessError) return;
          closedForAuth = true;
          stopReconnect(provider);
          setError(accessError);
          setIsLoading(false);
        });

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (cancelled || closedForAuth) return;

          if (event === "SIGNED_OUT") {
            closedForAuth = true;
            stopReconnect(provider);
            setError(
              new DocumentAccessError(
                "UNAUTHORIZED",
                "Please sign in to your account to access this doc."
              )
            );
            setIsLoading(false);
            return;
          }

          if (event === "TOKEN_REFRESHED" && nextSession?.access_token) {
            tokenRef.current = nextSession.access_token;
            try {
              provider.disconnect();
              provider.connect();
            } catch (err) {
              console.error("[PartyKit] Failed to reconnect with refreshed token:", err);
            }
          }
        });

        lastDocumentIdRef.current = documentId;
        initializedRef.current = true;
        setState({ ydoc, provider });
        if (isNew || paintedFromPrefetch) {
          markReady();
        }

        if (!isNew && cached === undefined) {
          void utils.document.getDocumentState
            .fetch(documentId, { staleTime: DOCUMENT_STATE_STALE_MS })
            .then((data) => {
              if (cancelled || closedForAuth) return;
              applyPrefetchedState(ydoc, data.state);
              markReady();
            })
            .catch((err: unknown) => {
              if (cancelled || closedForAuth) return;
              const accessError = accessErrorFromTrpc(err);
              if (!accessError) return;
              closedForAuth = true;
              stopReconnect(provider);
              setError(accessError);
              setIsLoading(false);
            });
        }

        cleanupRef.current = () => {
          cancelled = true;
          initializedRef.current = false;
          subscription.unsubscribe();
          try {
            provider.destroy();
          } catch {}
          try {
            ydoc.destroy();
          } catch {}
          setState(null);
          setIsReady(false);
        };
      } catch (err) {
        console.error("[PartyKit] Setup error:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // utils is a stable tRPC client; including it retriggers setup and tears down the room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, isNew]);

  return {
    ydoc: state?.ydoc ?? null,
    provider: state?.provider ?? null,
    isReady,
    isLoading,
    error,
  };
}
