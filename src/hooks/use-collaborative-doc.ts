import { useEffect, useState, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

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

// Helper to apply base64 snapshot to Y.Doc
function applyBase64Snapshot(ydoc: Y.Doc, snapshot: string): void {
    const binary = Buffer.from(snapshot, "base64");
    Y.applyUpdate(ydoc, new Uint8Array(binary));
}

// Throttle utility for snapshot persistence
function createThrottle(interval: number, minInterval: number) {
    let lastCall = 0;
    let callCount = 0;
    const maxCalls = 200; // UPDATE_INTERVAL

    return (callback: () => void) => {
        callCount++;
        const now = Date.now();

        if (callCount >= maxCalls || now - lastCall >= minInterval) {
            callCount = 0;
            lastCall = now;
            callback();
        }
    };
}

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

    const providerRef = useRef<WebrtcProvider | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const onSnapshotPersistRef = useRef(onSnapshotPersist);
    
    // Update ref when callback changes
    useEffect(() => {
        onSnapshotPersistRef.current = onSnapshotPersist;
    }, [onSnapshotPersist]);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            // Clean up previous provider if it exists
            if (providerRef.current) {
                try {
                    providerRef.current.destroy();
                } catch (error) {
                    console.warn("Error destroying previous provider:", error);
                }
                providerRef.current = null;
            }
            if (ydocRef.current) {
                try {
                    ydocRef.current.destroy();
                } catch (error) {
                    console.warn("Error destroying previous ydoc:", error);
                }
                ydocRef.current = null;
            }

            // Small delay to ensure cleanup completes
            await new Promise((resolve) => setTimeout(resolve, 100));

            if (!isMounted) return;

            const ydoc = new Y.Doc();
            const provider = new WebrtcProvider(documentId, ydoc);

            providerRef.current = provider;
            ydocRef.current = ydoc;

            // Wait for WebRTC to potentially reconnect and sync
            await new Promise((resolve) => setTimeout(resolve, 1500));

            if (!isMounted) {
                provider.destroy();
                ydoc.destroy();
                return;
            }

            // Check for active session (peers connected)
            const states = provider.awareness.getStates();
            const otherClients = Array.from(states.keys()).filter(
                (id) => id !== provider.awareness.clientID
            );
            const hasActiveSession = otherClients.length > 0;

            // Check if Y.Doc has content (from WebRTC sync)
            const docHasContent = ydoc.share.size > 0;

            // Only load snapshot if no active session and no content
            const shouldLoadSnapshot =
                !hasActiveSession &&
                !docHasContent &&
                snapshotData?.success &&
                snapshotData.snapshot;

            if (shouldLoadSnapshot) {
                try {
                    applyBase64Snapshot(ydoc, snapshotData.snapshot);
                    console.log("Loaded snapshot (no active session detected)");
                } catch (err) {
                    console.error("Snapshot load failed:", err);
                }
            } else if (hasActiveSession || docHasContent) {
                console.log(
                    "Active session detected or content synced from WebRTC - skipping snapshot load"
                );
            }

            setState({ ydoc, provider });
            setIsReady(true);

            // ---------------- Leader election ----------------
            let isLeader = false;
            const clientId = provider.awareness.clientID;

            const calculateLeader = () => {
                const states = provider.awareness.getStates();
                const clientIds = Array.from(states.keys());
                if (clientIds.length === 0) {
                    isLeader = false;
                    return;
                }
                const leaderId = Math.min(...clientIds);
                isLeader = clientId === leaderId;
                console.log("Leader:", isLeader);
            };

            provider.on("peers", calculateLeader);
            provider.awareness.on("change", calculateLeader);

            // ---------------- Snapshot persistence ----------------
            const throttleSnapshot = createThrottle(200, 5000);

            const handleUpdate = (update: Uint8Array, origin: unknown) => {
                const isLocal = origin !== null;

                if (!isLocal || !isLeader) return;

                throttleSnapshot(() => {
                    const snapshot = Y.encodeStateAsUpdate(ydoc);
                    const base64Snapshot = Buffer.from(snapshot).toString("base64");
                    onSnapshotPersistRef.current(base64Snapshot);
                });
            };

            ydoc.on("update", handleUpdate);

            // Return cleanup function
            return () => {
                provider.off("peers", calculateLeader);
                provider.awareness.off("change", calculateLeader);
                ydoc.off("update", handleUpdate);

                try {
                    provider.destroy();
                } catch (error) {
                    console.warn("Error destroying provider in cleanup:", error);
                }
                try {
                    ydoc.destroy();
                } catch (error) {
                    console.warn("Error destroying ydoc in cleanup:", error);
                }

                providerRef.current = null;
                ydocRef.current = null;
                setState(null);
                setIsReady(false);
            };
        };

        // Initialize and get cleanup function
        let cleanup: (() => void) | undefined;

        if (snapshotData !== undefined) {
            void initialize().then((cleanupFn) => {
                if (isMounted && cleanupFn) {
                    cleanup = cleanupFn;
                } else if (cleanupFn) {
                    // Component unmounted before initialization completed
                    cleanupFn();
                }
            });
        }

        return () => {
            isMounted = false;
            if (cleanup) {
                cleanup();
            }
            // Also cleanup refs on unmount
            if (providerRef.current) {
                try {
                    providerRef.current.destroy();
                } catch (error) {
                    console.warn("Error destroying provider on unmount:", error);
                }
                providerRef.current = null;
            }
            if (ydocRef.current) {
                try {
                    ydocRef.current.destroy();
                } catch (error) {
                    console.warn("Error destroying ydoc on unmount:", error);
                }
                ydocRef.current = null;
            }
        };
    }, [documentId, snapshotData]);

    return {
        ydoc: state?.ydoc ?? null,
        provider: state?.provider ?? null,
        isReady,
    };
}

