"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { TRPCClientError } from "@trpc/client";
import { DocumentError } from "~/app/_components/document-error";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCollaborativeDocCrdt } from "~/hooks/use-collaborative-doc-crdt";
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
  const { isNew } = useNewDocumentFlag();

  const Editor = useMemo(
    () =>
      dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }),
    [],
  );

  // Fetch user profile
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile();

  // CRDT-based collaborative doc - handles fetching and saving internally
  const { ydoc, provider, isReady, isLoading, error } = useCollaborativeDocCrdt(
    {
      documentId,
      isNew,
    },
  );

  // === RENDERING LOGIC ===

  // 1. Handle errors
  if (error) {
    const errorCode = getErrorCode(error);
    const isForbidden =
      errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED";

    // NOT_FOUND is valid for collaborative apps (room not saved yet)
    if (errorCode === "NOT_FOUND") {
      // Continue to render - WebRTC will sync from peers
    } else {
      const getErrorMessage = () => {
        if (isForbidden) {
          return "You don't have permission to view this document.";
        }
        if (errorCode === "INTERNAL_SERVER_ERROR") {
          return "Something went wrong on our end. Please try again.";
        }
        return "Something unexpected happened. Please try refreshing.";
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
  }

  // 2. Show loading skeleton
  //    - Skip for optimistic creates (isNew = true)
  //    - Show while CRDT changes are loading or provider isn't ready
  if (
    !isNew &&
    (isLoading || !isReady || !ydoc || !provider || isProfileLoading)
  ) {
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

  // 3. Still waiting for ydoc/provider (optimistic case)
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

  // 4. Ready to render
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
