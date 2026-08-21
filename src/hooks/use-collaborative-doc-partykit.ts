"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
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

    const setup = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(`Failed to get session: ${sessionError.message}`);
        }

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const ydoc = new Y.Doc();

        // Pass isNew flag to PartyKit
        const provider = new YPartyKitProvider(PARTYKIT_HOST, documentId, ydoc, {
          connect: true,
          params: {
            token: session.access_token,
            isNew: isNew ? "true" : "false",
          },
        });

        provider.on("sync", (synced: boolean) => {
          if (synced) {
            setIsReady(true);
            setIsLoading(false);
          }
        });

        provider.on("connection-error", (err: Error) => {
          console.error("[PartyKit] Connection error:", err);
          setError(err);
          setIsLoading(false);
        });

        provider.on("connection-close", (event: CloseEvent) => {
          if (event.code === 4001) {
            setError(new Error("Unauthorized: Please sign in"));
            setIsLoading(false);
          } else if (event.code === 4003) {
            setError(new Error("You don't have access to this document"));
            setIsLoading(false);
          } else if (event.code === 4004) {
            setError(new Error("Document not found"));
            setIsLoading(false);
          }
        });

        lastDocumentIdRef.current = documentId;
        initializedRef.current = true;
        setState({ ydoc, provider });

        cleanupRef.current = () => {
          initializedRef.current = false;
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
