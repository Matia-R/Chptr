"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { TRPCClientError } from "@trpc/client";
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
      retry: (failureCount, error) => {
        // Don't retry if the error is UNAUTHORIZED
        if (
          error instanceof TRPCClientError &&
          (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED"
        ) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
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

  const { ydoc, provider, isReady } = useCollaborativeDoc({
    documentId,
    snapshotData,
    onSnapshotPersist: handleSnapshotPersist,
  });

  // Check if error is unauthorized
  const isUnauthorized =
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED";

  const getErrorMessage = () => {
    if (isUnauthorized) {
      return "You don't have permission to view this document. If you believe this is an error, please contact the document owner.";
    }

    if (error instanceof TRPCClientError) {
      const errorCode = (error.data as { code?: string } | undefined)?.code;

      if (errorCode === "INTERNAL_SERVER_ERROR") {
        return "Something went wrong on our end. Please try again in a moment.";
      }

      if (errorCode === "NOT_FOUND") {
        return "This document could not be found. It may have been deleted or moved.";
      }

      return (
        error.message ||
        "We encountered an issue loading this document. Please try again."
      );
    }

    if (error instanceof Error) {
      // For generic errors, provide a friendly message
      return "We're having trouble loading this document. Please refresh the page or try again later.";
    }

    return "Something unexpected happened. Please try refreshing the page.";
  };

  // Handle errors - show DocumentError for unauthorized access
  if (error) {
    return (
      <MotionFade>
        <DocumentError
          title={isUnauthorized ? "Access Denied" : "Unable to Load Document"}
          message={getErrorMessage()}
        />
      </MotionFade>
    );
  }

  // Handle case where snapshot data indicates failure
  if (snapshotData && !snapshotData.success) {
    return (
      <MotionFade>
        <DocumentError
          title="Unable to Load Document"
          message="We couldn't load the document content. Please try refreshing the page or contact support if the problem persists."
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
