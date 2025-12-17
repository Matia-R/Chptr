'use client'

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo, useCallback } from "react"
import { api } from "~/trpc/react"
import { DocumentError } from "~/app/_components/document-error"
import { MotionFade } from "~/app/_components/motion-fade"
import { useCollaborativeDoc } from "~/hooks/use-collaborative-doc"
import { getAvatarColorHex } from "~/lib/avatar-colors"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string
    const Editor = useMemo(() => dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }), []);

    // Fetch user profile
    const { data: userProfile } = api.user.getCurrentUserProfile.useQuery();

    // Fetch latest snapshot
    const { data: snapshotData, error } = api.document.getLatestDocumentSnapshot.useQuery(documentId, {
        enabled: !!documentId,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
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

    if (error || (snapshotData && !snapshotData.success)) {
        return (
            <MotionFade>
                <DocumentError title="Error loading document" message={error?.message ?? "Unknown error"} />
            </MotionFade>
        );
    }

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

    // Get user name and color from profile
    const userName = userProfile 
        ? `${userProfile.first_name} ${userProfile.last_name}` 
        : "Anonymous User";
    const userColor = getAvatarColorHex(userProfile?.default_avatar_background_color);

    return (
        <MotionFade>
            <Editor
                documentId={documentId}
                userName={userName}
                userColor={userColor}
                ydoc={ydoc}
                provider={provider}
            />
        </MotionFade>
    )
}
