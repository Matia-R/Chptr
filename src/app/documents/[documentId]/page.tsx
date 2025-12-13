'use client'

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo, useCallback } from "react"
import { api } from "~/trpc/react"
import { DocumentError } from "~/app/_components/document-error"
import { MotionFade } from "~/app/_components/motion-fade"
import { useCollaborativeDoc } from "~/hooks/use-collaborative-doc"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string
    const Editor = useMemo(() => dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }), []);

    // Fetch latest snapshot
    const { data: snapshotData } = api.document.getLatestDocumentSnapshot.useQuery(documentId, {
        enabled: !!documentId,
    });

    // Setup snapshot persistence mutation
    const persistSnapshotMutation = api.document.persistDocumentSnapshot.useMutation({
        onError: (error: unknown) => {
            console.error('Failed to persist document snapshot:', error);
        },
    });

    // Callback for snapshot persistence
    const handleSnapshotPersist = useCallback((snapshotData: string) => {
        persistSnapshotMutation.mutate({
            documentId,
            snapshotData,
        });
    }, [documentId, persistSnapshotMutation]);

    // Use collaborative doc hook
    const { ydoc, provider, isReady } = useCollaborativeDoc({
        documentId,
        snapshotData,
        onSnapshotPersist: handleSnapshotPersist,
    });

    const { data: documentData, error } = api.document.getDocumentById.useQuery(documentId)

    if (!isReady || !ydoc || !provider) {
        return (
            <MotionFade>
                <div className="space-y-4 animate-pulse">
                    <div className="h-9 w-2/3 bg-muted rounded-lg" />
                    <div className="space-y-3">
                        <div className="h-4 bg-muted rounded" />
                        <div className="h-4 bg-muted rounded w-[95%]" />
                        <div className="h-4 bg-muted rounded w-[90%]" />
                    </div>
                    <div className="space-y-3 pt-4">
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

    return (
        <MotionFade>
            <Editor
                documentId={documentId}
                userName={"Matia Raspopovic"}
                userColor={"#3b82f6"}
                ydoc={ydoc}
                provider={provider}
            />
        </MotionFade>
    )
}
