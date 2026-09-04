"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { TRPCClientError } from "@trpc/client";
import {
  DocumentAccessError,
  getDocumentErrorCode,
  isFatalDocumentCloseCode,
  type DocumentConnectionStatus,
} from "~/lib/document-access-error";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useCollaborativeDocStore } from "~/app/_components/editor/collaborative-doc-store";
import {
  getYjsContentHash,
  getYjsPublishedContentHash,
} from "~/lib/yjs-publish-state";

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
  connection: DocumentConnectionStatus;
  isReconnecting: boolean;
  retryConnection: () => void;
}

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

const DOCUMENT_STATE_STALE_MS = 30_000;
const MAX_RESUME_BACKOFF_MS = 5_000;
/** Hide brief tab-focus / idle-timeout reconnects. `offline` skips this. */
const RECONNECT_UI_GRACE_MS = 2_000;
/** Let BlockNote finish binding before treating Yjs updates as publish-dirty. */
const YJS_PUBLISH_WATCH_DELAY_MS = 150;

function loginRequired() {
  return new DocumentAccessError(
    "UNAUTHORIZED",
    "Please sign in to your account to access this doc.",
  );
}

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
    console.error(
      "[PartyKit] Failed to apply prefetched document state:",
      error,
    );
  }
}

function accessErrorForCloseCode(code: number): DocumentAccessError | null {
  switch (code) {
    case 4000:
      return new DocumentAccessError(
        "BAD_REQUEST",
        "The URL provided is incomplete or malformed.",
      );
    case 4003:
      return new DocumentAccessError(
        "FORBIDDEN",
        "Looks like you don't have access to this doc.",
      );
    case 4004:
      return new DocumentAccessError("NOT_FOUND", "This doc doesn’t exist.");
    default:
      return null;
  }
}

function accessErrorFromTrpc(error: unknown): DocumentAccessError | null {
  const code = getDocumentErrorCode(error);
  if (code === "FORBIDDEN") {
    return new DocumentAccessError(
      "FORBIDDEN",
      "Looks like you don't have access to this doc.",
    );
  }
  if (code === "NOT_FOUND") {
    return new DocumentAccessError("NOT_FOUND", "This doc doesn’t exist.");
  }
  if (code === "UNAUTHORIZED") {
    return new DocumentAccessError(
      "UNAUTHORIZED",
      "Please sign in to your account to access this doc.",
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function socketIsOpen(provider: YPartyKitProvider) {
  return provider.wsconnected && provider.ws?.readyState === WebSocket.OPEN;
}

/** Prevent y-partykit's 30s idle timer from killing a socket after a frozen tab. */
function markSocketAlive(provider: YPartyKitProvider) {
  if (!socketIsOpen(provider) || !provider.ws) return false;
  provider.wsLastMessageReceived = Date.now();
  return true;
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
  const [connection, setConnection] =
    useState<DocumentConnectionStatus>("connecting");
  const [everConnected, setEverConnected] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const lastDocumentIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const retryConnectionRef = useRef<(() => void) | null>(null);
  const isOffline = useBrowserOffline();
  const [showReconnectUi, setShowReconnectUi] = useState(false);

  const retryConnection = useCallback(() => {
    retryConnectionRef.current?.();
  }, []);

  // True outages (`offline`) show immediately. Socket blips (tab freeze,
  // token refresh, brief close) only show if we are still down after a grace.
  useEffect(() => {
    const down =
      isOffline ||
      connection === "disconnected" ||
      (everConnected && connection === "connecting");

    if (isOffline) {
      setShowReconnectUi(true);
      return;
    }
    if (!down) {
      setShowReconnectUi(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowReconnectUi(true);
    }, RECONNECT_UI_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [isOffline, connection, everConnected]);

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
    setConnection("connecting");
    setEverConnected(false);
    setShowReconnectUi(false);

    useCollaborativeDocStore.getState().bindDocument({
      documentId,
      isPersisted: !isNew,
    });

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
            `Failed to get session: ${sessionError.message}`,
          );
        }

        if (!session?.access_token) {
          throw loginRequired();
        }

        if (cancelled) return;

        const ydoc = new Y.Doc();
        useCollaborativeDocStore.getState().setYdoc(ydoc);
        const tokenRef = { current: session.access_token };
        let closedForAuth = false;
        let paintedFromPrefetch = false;
        let resumeInFlight = false;
        let consecutiveFailures = 0;

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

        const provider = new YPartyKitProvider(
          PARTYKIT_HOST,
          documentId,
          ydoc,
          {
            connect: true,
            params: () => ({
              token: tokenRef.current,
              isNew: isNew ? "true" : "false",
            }),
          },
        );

        const failFatal = (accessError: DocumentAccessError) => {
          closedForAuth = true;
          stopReconnect(provider);
          setError(accessError);
          setIsLoading(false);
        };

        // y-partykit's built-in retry calls setupWS with the URL from the last
        // connect(), so a sleep/wake reconnect would reuse an expired JWT.
        // Pause that retry and reconnect through provider.connect() so params()
        // runs again with a refreshed token.
        const isBrowserOffline = () =>
          typeof navigator !== "undefined" && navigator.onLine === false;

        const resumeWithFreshToken = async (options?: {
          immediate?: boolean;
        }) => {
          if (resumeInFlight || cancelled || closedForAuth) return;
          if (isBrowserOffline()) {
            setConnection("disconnected");
            provider.shouldConnect = false;
            return;
          }
          if (socketIsOpen(provider)) return;
          resumeInFlight = true;
          try {
            if (!options?.immediate && consecutiveFailures > 1) {
              const delay = Math.min(
                100 * 2 ** (consecutiveFailures - 1),
                MAX_RESUME_BACKOFF_MS,
              );
              await wait(delay);
              if (cancelled || closedForAuth) return;
            }

            const {
              data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
              failFatal(loginRequired());
              return;
            }

            tokenRef.current = currentSession.access_token;
            if (cancelled || closedForAuth) return;
            provider.connect();

            void supabase.auth
              .refreshSession()
              .then(({ data, error: refreshError }) => {
                if (cancelled || closedForAuth) return;
                if (data.session?.access_token) {
                  tokenRef.current = data.session.access_token;
                }
                if (refreshError) {
                  const status = (refreshError as { status?: number }).status;
                  if (!data.session && (status === 400 || status === 401)) {
                    failFatal(loginRequired());
                  }
                }
              });
          } catch (err) {
            console.error("[PartyKit] Failed to resume connection:", err);
            consecutiveFailures += 1;
            if (!cancelled && !closedForAuth && tokenRef.current) {
              try {
                provider.connect();
              } catch {
                // Next visibility/online/retry will try again.
              }
            }
          } finally {
            resumeInFlight = false;
          }
        };

        retryConnectionRef.current = () => {
          if (closedForAuth || cancelled) return;
          consecutiveFailures = 0;
          void resumeWithFreshToken({ immediate: true });
        };

        let publishWatchReady = false;
        let sessionBaselineHash: string | null = null;
        let publishWatchTimer: number | null = null;

        const recomputePublishDirty = () => {
          const publishedHash = getYjsPublishedContentHash(ydoc);
          const currentHash = getYjsContentHash(ydoc);
          const hasYjsPublishHash = publishedHash !== undefined;
          const isYjsContentDirty = hasYjsPublishHash
            ? currentHash !== publishedHash
            : sessionBaselineHash != null &&
              currentHash !== sessionBaselineHash;
          useCollaborativeDocStore.getState().setYjsPublishState({
            isYjsContentDirty,
            hasYjsPublishHash,
          });
        };

        const onYjsUpdate = (_update: Uint8Array, origin: unknown) => {
          if (origin === "prefetch") return;
          if (!publishWatchReady) return;
          recomputePublishDirty();
        };
        ydoc.on("update", onYjsUpdate);

        provider.on("sync", (synced: boolean) => {
          if (synced && !closedForAuth && !isNew) {
            markReady();
          }
          if (synced && !publishWatchReady && publishWatchTimer == null) {
            publishWatchTimer = window.setTimeout(() => {
              publishWatchReady = true;
              sessionBaselineHash = getYjsContentHash(ydoc);
              recomputePublishDirty();
            }, YJS_PUBLISH_WATCH_DELAY_MS);
          }
        });

        provider.on(
          "status",
          ({ status }: { status: DocumentConnectionStatus }) => {
            if (closedForAuth || cancelled) return;
            setConnection(status);
            if (status === "connected") {
              consecutiveFailures = 0;
              setEverConnected(true);
              useCollaborativeDocStore.getState().setPersisted(true);
            }
          },
        );

        provider.on("connection-close", (event: CloseEvent) => {
          if (closedForAuth || cancelled) return;

          const fatalError = isFatalDocumentCloseCode(event.code)
            ? accessErrorForCloseCode(event.code)
            : null;
          if (fatalError) {
            failFatal(fatalError);
            return;
          }

          // 4001 is an expired/stale JWT on reconnect, not a sign-out.
          // 4005 is PartyKit failing to reach the app (sleep, restart, blip).
          // Transport closes (1001/1006) are the laptop-lid / network drop.
          consecutiveFailures += 1;
          setConnection("disconnected");
          provider.shouldConnect = false;
          if (isBrowserOffline()) return;
          void resumeWithFreshToken({ immediate: consecutiveFailures === 1 });
        });

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (cancelled || closedForAuth) return;

          if (event === "SIGNED_OUT") {
            failFatal(loginRequired());
            return;
          }

          if (event === "TOKEN_REFRESHED" && nextSession?.access_token) {
            tokenRef.current = nextSession.access_token;
            if (isBrowserOffline()) return;
            if (socketIsOpen(provider)) {
              // Keep the live socket. The new JWT is used on the next
              // real reconnect so a tab-focus refresh does not flash the UI.
              return;
            }
            void resumeWithFreshToken({ immediate: true });
          }
        });

        const onOffline = () => {
          if (cancelled || closedForAuth) return;
          setConnection("disconnected");
          provider.shouldConnect = false;
          try {
            provider.ws?.close();
          } catch {
            // Socket may already be closing.
          }
        };

        const onVisible = () => {
          if (cancelled || closedForAuth) return;
          if (
            typeof document !== "undefined" &&
            document.visibilityState === "hidden"
          ) {
            return;
          }
          if (isBrowserOffline()) return;
          // Tab focus is not a disconnect. Keep an open socket and reset
          // y-partykit's idle timer so a frozen tab does not look dead.
          if (markSocketAlive(provider)) return;
          consecutiveFailures = 0;
          void resumeWithFreshToken({ immediate: true });
        };

        const onOnline = () => {
          if (cancelled || closedForAuth) return;
          if (isBrowserOffline()) return;
          consecutiveFailures = 0;
          if (markSocketAlive(provider)) return;
          void resumeWithFreshToken({ immediate: true });
        };

        document.addEventListener("visibilitychange", onVisible);
        document.addEventListener("resume", onVisible);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

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
              failFatal(accessError);
            });
        }

        cleanupRef.current = () => {
          cancelled = true;
          initializedRef.current = false;
          retryConnectionRef.current = null;
          if (publishWatchTimer != null) {
            window.clearTimeout(publishWatchTimer);
          }
          ydoc.off("update", onYjsUpdate);
          subscription.unsubscribe();
          document.removeEventListener("visibilitychange", onVisible);
          document.removeEventListener("resume", onVisible);
          window.removeEventListener("online", onOnline);
          window.removeEventListener("offline", onOffline);
          try {
            provider.destroy();
          } catch {}
          try {
            ydoc.destroy();
          } catch {}
          setState(null);
          setIsReady(false);
          useCollaborativeDocStore.getState().reset();
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
      const store = useCollaborativeDocStore.getState();
      if (store.documentId === documentId) {
        store.reset();
      }
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
    connection,
    isReconnecting: showReconnectUi,
    retryConnection,
  };
}
