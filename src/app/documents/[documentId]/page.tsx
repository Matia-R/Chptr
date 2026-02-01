"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { TRPCClientError } from "@trpc/client";
import { DocumentError } from "~/app/_components/document-error";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCollaborativeDoc } from "~/hooks/use-collaborative-doc";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useUserProfile } from "~/hooks/use-user-profile";
import { getAvatarColorHex } from "~/lib/avatar-colors";

// Helper to extract error code from TRPC error
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof TRPCClientError) {
    return (error.data as { code?: string } | undefined)?.code;
  }
  return undefined;
}

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.documentId as string;

  // Handle in-memory "new document" flag for instant creation
  // isNew = true means user clicked "New" button (optimistic)
  // isNew = false means user landed on URL (pessimistic - wait for query)
  const { isNew, clearFlag } = useNewDocumentFlag();

  const utils = api.useUtils();

  const Editor = useMemo(
    () =>
      dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }),
    [],
  );

  // Fetch user profile (shared query, automatically deduplicated by React Query)
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile();

  // Fetch latest snapshot
  // - BYPASSED if this is an intentional new document (isNew = true)
  // - For URL landings (isNew = false), we wait for the query
  const {
    data: snapshotData,
    error,
    isLoading: isSnapshotLoading,
  } = api.document.getLatestDocumentSnapshot.useQuery(documentId, {
    enabled: !!documentId && !isNew,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (failureCount, err) => {
      const code = getErrorCode(err);
      // Don't retry for auth errors or not found (these are definitive)
      if (
        code === "UNAUTHORIZED" ||
        code === "FORBIDDEN" ||
        code === "NOT_FOUND"
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Determine error type for different handling
  const errorCode = getErrorCode(error);
  const isNotFound = errorCode === "NOT_FOUND";
  const isForbidden = errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED";

  // For "NOT_FOUND", we treat this as a valid empty room (collaborative join before save)
  // The WebRTC provider will sync content from peers if any exist
  const effectiveSnapshotData = useMemo(() => {
    // Intentional create: instant empty editor
    if (isNew) {
      return { success: true, snapshot: null };
    }
    // 404 = room not saved yet, treat as empty (WebRTC will sync)
    if (isNotFound) {
      return { success: true, snapshot: null };
    }
    // Normal case: return actual data
    return snapshotData;
  }, [isNew, isNotFound, snapshotData]);

  // Setup snapshot persistence mutation
  const persistSnapshotMutation =
    api.document.persistDocumentSnapshot.useMutation({
      onSuccess: () => {
        // Clear "new" flag on first successful persistence
        if (isNew) {
          clearFlag();
          // Refresh sidebar document list (the doc was just created in DB)
          void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
        }
      },
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
    snapshotData: effectiveSnapshotData,
    onSnapshotPersist: handleSnapshotPersist,
  });

  // === RENDERING LOGIC ===
  // The order matters: errors → loading → ready

  // 1. Handle real errors (FORBIDDEN, UNAUTHORIZED, server errors)
  //    NOT_FOUND is NOT an error in collaborative apps - it's just "room not saved yet"
  if (error && !isNotFound) {
    const getErrorMessage = () => {
      if (isForbidden) {
        return "You don't have permission to view this document. If you believe this is an error, please contact the document owner.";
      }
      if (errorCode === "INTERNAL_SERVER_ERROR") {
        return "Something went wrong on our end. Please try again in a moment.";
      }
      if (error instanceof TRPCClientError) {
        return (
          error.message || "We encountered an issue loading this document."
        );
      }
      return "Something unexpected happened. Please try refreshing the page.";
    };

    return (
      <MotionFade>
        <DocumentError
          title={isForbidden ? "Access Denied" : "Unable to Load Document"}
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

  // 2. Show loading skeleton for pessimistic case (landing on URL)
  //    Skip loading for optimistic case (intentional create) or if we got a 404
  const shouldShowLoading =
    !isNew &&
    !isNotFound &&
    (isSnapshotLoading || !isReady || !ydoc || !provider || isProfileLoading);

  if (shouldShowLoading) {
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

  // 3. For optimistic creates, we might not have ydoc ready yet but still want to show something
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
        </div>
      </MotionFade>
    );
  }

  // 4. Ready to render the editor
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
