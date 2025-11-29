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

    const persistUpdateMutation = api.document.persistDocumentUpdate.useMutation({
        onError: (error: unknown) => {
            console.error('Failed to persist document update:', error);
        },
    });

    // Use ref to store the mutate function to avoid dependency issues
    const persistUpdateRef = useRef(persistUpdateMutation.mutate);
    persistUpdateRef.current = persistUpdateMutation.mutate;

    useEffect(() => {
        // Create new Y.Doc and provider for this document
        const ydoc = new Y.Doc()
        const provider = new WebrtcProvider(documentId, ydoc)
        
        setCollabState({ ydoc, provider })

        // Listen to Yjs updates and persist them
        const handleUpdate = (update: Uint8Array, origin: unknown) => {
            // Only persist updates that originate from this client (not from provider sync)
            // The provider will sync updates from other clients, but we only want to persist
            // updates that we generate locally
            if (origin !== provider) {
                // Convert Uint8Array to base64 for transmission (browser-compatible)
                const binaryString = Array.from(update, byte => String.fromCharCode(byte)).join('');
                const base64Update = btoa(binaryString);
                
                // Persist the update using the ref
                persistUpdateRef.current({
                    documentId,
                    updateData: base64Update,
                });
            }
        };

        ydoc.on('update', handleUpdate);

        // Cleanup on unmount or documentId change
        return () => {
            ydoc.off('update', handleUpdate);
            provider.destroy()
            ydoc.destroy()
            setCollabState(null)
        }
    }, [documentId])

    const { data: documentData, isLoading, error } = api.document.getDocumentById.useQuery(documentId)

    if (isLoading) {
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
    if (!collabState) {
        return (
            <MotionFade>
                <div className="space-y-4 animate-pulse">
                    <div className="h-9 w-2/3 bg-muted rounded-lg" />
                    <div className="space-y-3">
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded w-[95%]" />
                    </div>
                </div>
            </MotionFade>
        )
    }

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
