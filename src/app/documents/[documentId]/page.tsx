"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { DocumentError } from "~/app/_components/document-error";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCollaborativeDoc } from "~/hooks/use-collaborative-doc";
import { useUserProfile } from "~/hooks/use-user-profile";
import { getAvatarColorHex } from "~/lib/avatar-colors";

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const Editor = useMemo(
    () =>
      dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }),
    [],
  );

  // Fetch user profile (shared query, automatically deduplicated by React Query)
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile();

  // Fetch latest snapshot
  const { data: snapshotData, error } =
    api.document.getLatestDocumentSnapshot.useQuery(documentId, {
      enabled: !!documentId,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    });

  // Setup snapshot persistence mutation
  const persistSnapshotMutation =
    api.document.persistDocumentSnapshot.useMutation({
      onError: (error: unknown) => {
        console.error("Failed to persist document snapshot:", error);
      },
    });

  // Callback for snapshot persistence
  const handleSnapshotPersist = useCallback(
    (snapshotData: string) => {
      persistSnapshotMutation.mutate({
        documentId,
        snapshotData,
      });
    },
    [documentId, persistSnapshotMutation],
  );

  // Use collaborative doc hook
  const { ydoc, provider, isReady } = useCollaborativeDoc({
    documentId,
    snapshotData,
    onSnapshotPersist: handleSnapshotPersist,
  });

  if (error || (snapshotData && !snapshotData.success)) {
    return (
      <MotionFade>
        <DocumentError
          title="Error loading document"
          message={error?.message ?? "Unknown error"}
        />
      </MotionFade>
    );
  }

  if (!isReady || !ydoc || !provider || isProfileLoading) {
    return (
      <MotionFade>
        <div className="animate-pulse space-y-4">
          <div className="h-9 w-2/3 rounded-lg bg-muted" />
          <div className="space-y-3">
            <div className="h-4 rounded bg-muted" />
            <div className="h-4 w-[95%] rounded bg-muted" />
            <div className="h-4 w-[90%] rounded bg-muted" />
          </div>
          <div className="space-y-3 pt-4">
            <div className="h-4 w-[85%] rounded bg-muted" />
            <div className="h-4 w-[88%] rounded bg-muted" />
            <div className="h-4 w-[92%] rounded bg-muted" />
          </div>
        </div>
      </MotionFade>
    );
  }

  // Get user name and color from profile
  const userName = userProfile
    ? `${userProfile.first_name} ${userProfile.last_name}`
    : "Anonymous User";
  const userColor = getAvatarColorHex(
    userProfile?.default_avatar_background_color,
  );

  return (
    <MotionFade>
      <Editor
        userName={userName}
        userColor={userColor}
        ydoc={ydoc}
        provider={provider}
      />
    </MotionFade>
  );
}
