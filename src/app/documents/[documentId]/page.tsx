'use client'

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo, useEffect, useState, useRef } from "react"
import { api } from "~/trpc/react"
import { DocumentError } from "~/app/_components/document-error"
import { MotionFade } from "~/app/_components/motion-fade"
import * as Y from "yjs"
import { WebrtcProvider } from "y-webrtc"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string
    const Editor = useMemo(() => dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }), []);

    // --- Setup Yjs provider at page level ---
    const [collabState, setCollabState] = useState<{
        ydoc: Y.Doc;
        provider: WebrtcProvider;
    } | null>(null)

    // Ref to track current provider for cleanup
    const providerRef = useRef<WebrtcProvider | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);

    const persistSnapshotMutation = api.document.persistDocumentSnapshot.useMutation({
        onError: (error: unknown) => {
            console.error('Failed to persist document snapshot:', error);
        },
    });

    // Use ref to store the mutate function to avoid dependency issues
    const persistSnapshotRef = useRef(persistSnapshotMutation.mutate);
    persistSnapshotRef.current = persistSnapshotMutation.mutate;

    // Fetch latest snapshot
    const { data: snapshotData } = api.document.getLatestDocumentSnapshot.useQuery(documentId, {
        enabled: !!documentId,
    });

    useEffect(() => {
        let isMounted = true;
    
        const initializeDocument = async () => {
            // Clean up previous provider if it exists
            if (providerRef.current) {
                try {
                    providerRef.current.destroy();
                } catch (error) {
                    console.warn('Error destroying previous provider:', error);
                }
                providerRef.current = null;
            }
            if (ydocRef.current) {
                try {
                    ydocRef.current.destroy();
                } catch (error) {
                    console.warn('Error destroying previous ydoc:', error);
                }
                ydocRef.current = null;
            }
            
            // Small delay to ensure cleanup completes before creating new provider
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!isMounted) return;
            
            const ydoc = new Y.Doc();
            const provider = new WebrtcProvider(documentId, ydoc);
            
            // Store refs for cleanup
            providerRef.current = provider;
            ydocRef.current = ydoc;
    
            // Track if Y.Doc receives any content from WebRTC sync
            let hasReceivedContent = false;
            const checkForContent = () => {
                // Check if Y.Doc has any content by checking if it has been updated
                // We'll track this via update events
                hasReceivedContent = true;
            };
            ydoc.on('update', checkForContent);
    
            // Wait longer for WebRTC to reconnect and sync (1.5 seconds)
            // This gives time for peers to connect and sync content
            await new Promise(resolve => setTimeout(resolve, 1500));
    
            if (!isMounted) {
                ydoc.off('update', checkForContent);
                provider.destroy();
                ydoc.destroy();
                return;
            }
    
            // Check for active session (peers connected)
            const states = provider.awareness.getStates();
            const otherClients = Array.from(states.keys()).filter(id => id !== provider.awareness.clientID);
            const hasActiveSession = otherClients.length > 0;
    
            // Check if Y.Doc has content (from WebRTC sync)
            // If it has content, we're reconnecting to an active session
            const docHasContent = hasReceivedContent || ydoc.share.size > 0;
    
            // Only load snapshot if:
            // 1. No active session (no peers)
            // 2. Y.Doc has no content (hasn't synced from WebRTC)
            // 3. Snapshot exists
            const shouldLoadSnapshot = !hasActiveSession && !docHasContent && snapshotData?.success && snapshotData.snapshot;
    
            if (shouldLoadSnapshot) {
                try {
                    const binary = Buffer.from(snapshotData.snapshot, "base64");
                    Y.applyUpdate(ydoc, new Uint8Array(binary));
                    console.log("Loaded snapshot (no active session detected)");
                } catch (err) {
                    console.error("Snapshot load failed:", err);
                }
            } else if (hasActiveSession || docHasContent) {
                console.log("Active session detected or content synced from WebRTC - skipping snapshot load");
            }
    
            // Remove the temporary content check listener
            ydoc.off('update', checkForContent);
    
            setCollabState({ ydoc, provider });
    
            // ---------------- Leader election ----------------
    
            let isLeader = false;
            const clientId = provider.awareness.clientID;
    
            const calculateLeader = () => {
                const states = provider.awareness.getStates();
                const clientIds = Array.from(states.keys());
                const leaderId = Math.min(...clientIds);
                isLeader = clientId === leaderId;
                console.log("Leader:", isLeader);
            };
    
            provider.on("peers", calculateLeader);
            provider.awareness.on("change", calculateLeader);
    
            // ---------------- Snapshot persistence ----------------
    
            const SNAPSHOT_MIN_INTERVAL = 5000; // 5s throttle
            let lastSnapshotTime = 0;
            let updateCount = 0;
            const UPDATE_INTERVAL = 200; // Save every 200 updates
    
            const handleUpdate = (update: Uint8Array, origin: unknown) => {
                const isLocal = origin !== null;  // IMPORTANT FIX
    
                if (!isLocal || !isLeader) return;
    
                updateCount++;
                const now = Date.now();
    
                if (updateCount >= UPDATE_INTERVAL || now - lastSnapshotTime > SNAPSHOT_MIN_INTERVAL) {
                    updateCount = 0;
                    lastSnapshotTime = now;
    
                    const snapshot = Y.encodeStateAsUpdate(ydoc);
                    const base64Snapshot = Buffer.from(snapshot).toString("base64");
    
                    persistSnapshotRef.current({
                        documentId,
                        snapshotData: base64Snapshot,
                    });
                }
            };
    
            ydoc.on("update", handleUpdate);
    
            return () => {
                provider.off("peers", calculateLeader);
                provider.awareness.off("change", calculateLeader);
                ydoc.off("update", handleUpdate);
    
                try {
                    provider.destroy();
                } catch (error) {
                    console.warn('Error destroying provider in cleanup:', error);
                }
                try {
                    ydoc.destroy();
                } catch (error) {
                    console.warn('Error destroying ydoc in cleanup:', error);
                }
                
                providerRef.current = null;
                ydocRef.current = null;
                setCollabState(null);
            };
        };
    
        if (snapshotData !== undefined) {
            void initializeDocument();
        }
    
        return () => {
            isMounted = false;
            // Cleanup on unmount
            if (providerRef.current) {
                try {
                    providerRef.current.destroy();
                } catch (error) {
                    console.warn('Error destroying provider on unmount:', error);
                }
                providerRef.current = null;
            }
            if (ydocRef.current) {
                try {
                    ydocRef.current.destroy();
                } catch (error) {
                    console.warn('Error destroying ydoc on unmount:', error);
                }
                ydocRef.current = null;
            }
        };
    }, [documentId, snapshotData]);

    const { data: documentData, isLoading, error } = api.document.getDocumentById.useQuery(documentId)

    if (isLoading || !collabState) {
        return (
            <MotionFade>
                <div className="space-y-4 animate-pulse">
                    <div className="h-9 w-2/3 bg-muted rounded-lg" /> {/* Title skeleton */}
                    <div className="space-y-3">
                        {/* Paragraph skeletons */}
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded w-[95%]" />
                        <div className="h-4 bg-muted rounded w-[90%]" />
                    </div>
                    <div className="space-y-3 pt-4">
                        {/* More paragraph blocks */}
                        <div className="h-4 bg-muted rounded w-[85%]" />
                        <div className="h-4 bg-muted rounded w-[88%]" />
                        <div className="h-4 bg-muted rounded w-[92%]" />
                    </div>
                </div>
            </MotionFade>
        )
    }

    if (error) {
        return (
            <MotionFade>
                <DocumentError title="Error loading document" message={error.message} />
            </MotionFade>
        )
    }

    if (!documentData?.document?.content) {
        return (
            <MotionFade>
                <DocumentError title="Error loading document" message="Document content not found" />
            </MotionFade>
        )
    }

    // Only render editor when provider is ready
    // if (!collabState) {
    //     return (
    //         <MotionFade>
    //             <div className="space-y-4 animate-pulse">
    //                 <div className="h-9 w-2/3 bg-muted rounded-lg" />
    //                 <div className="space-y-3">
    //                     <div className="h-4 bg-muted rounded" />
    //                     <div className="h-4 bg-muted rounded w-[95%]" />
    //                 </div>
    //             </div>
    //         </MotionFade>
    //     )
    // }

    return (
        <MotionFade>
            <Editor
                // initialContent={content}
                documentId={documentId}
                userName={"Matia Raspopovic"}
                userColor={"#3b82f6"}
                ydoc={collabState.ydoc}
                provider={collabState.provider}
            />
        </MotionFade>
    )
}
