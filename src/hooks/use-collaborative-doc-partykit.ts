"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { DocumentAccessError } from "~/lib/document-access-error";
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

        const provider = new YPartyKitProvider(PARTYKIT_HOST, documentId, ydoc, {
          connect: true,
          params: () => ({
            token: tokenRef.current,
            isNew: isNew ? "true" : "false",
          }),
        });

        provider.on("sync", (synced: boolean) => {
          if (synced && !closedForAuth && !isNew) {
            setIsReady(true);
            setIsLoading(false);
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
        if (isNew) {
          setIsReady(true);
          setIsLoading(false);
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
  }, [documentId, isNew]);

  return {
    ydoc: state?.ydoc ?? null,
    provider: state?.provider ?? null,
    isReady,
    isLoading,
    error,
  };
}
