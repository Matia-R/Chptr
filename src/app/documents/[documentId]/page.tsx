"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/app/_components/alert";
import { DocumentLoadingSkeleton } from "~/app/_components/document-loading-skeleton";
import { MotionFade } from "~/app/_components/motion-fade";
import { Button } from "~/app/_components/ui/button";
import { useCollaborativeDocPartykit } from "~/hooks/use-collaborative-doc-partykit";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useUserProfile } from "~/hooks/use-user-profile";
import { getAvatarColorHex } from "~/lib/avatar-colors";
import { getDocumentErrorCode } from "~/lib/document-access-error";

const SKELETON_DELAY_MS = 500;

const DOCUMENT_ERROR = {
  NOT_FOUND: {
    title: "Doc not found",
    message:
      "This doc doesn’t exist. It may have been moved, deleted, or the link might be incorrect.",
  },
  BAD_REQUEST: {
    title: "Bad URL",
    message:
      "The URL provided is incomplete or malformed. Please check the link and try again.",
  },
  FORBIDDEN: {
    title: "Restricted access",
    message: "Looks like you don't have access to this doc.",
  },
  UNAUTHORIZED: {
    title: "Login required",
    message: "Please sign in to your account to access this doc.",
  },
  INTERNAL_SERVER_ERROR: {
    title: "Unable to load doc",
    message:
      "A technical issue occurred on our end. We’re working to resolve it.",
  },
  DEFAULT: {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again in a moment.",
  },
} as const;

function getDocumentErrorContent(error: unknown): {
  title: string;
  message: string;
} {
  const code = getDocumentErrorCode(error);
  const key: keyof typeof DOCUMENT_ERROR =
    code && code in DOCUMENT_ERROR ? code : "DEFAULT";
  return DOCUMENT_ERROR[key];
}

function ConnectionLostNotice({
  onRetry,
  keepEditing,
}: {
  onRetry: () => void;
  keepEditing: boolean;
}) {
  return (
    <Alert>
      <AlertTitle>Connection lost</AlertTitle>
      <AlertDescription>
        <p>
          {keepEditing
            ? "Reconnecting… Keep editing — your latest changes are still on this device and will sync when you’re back online."
            : "Reconnecting to your doc… We’ll load it as soon as we’re back online."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
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

  // Fetch user profile (non-blocking: editor shows with placeholder until loaded)
  const { data: userProfile } = useUserProfile();

  // PartyKit-based collaborative doc - handles fetching and saving on server
  const {
    ydoc,
    provider,
    isReady,
    isLoading,
    error,
    isReconnecting,
    retryConnection,
  } = useCollaborativeDocPartykit({
    documentId,
    isNew,
  });

  // Delayed skeleton: only show after SKELETON_DELAY_MS to avoid flicker on fast loads.
  // New docs skip the skeleton entirely — local Y.Doc is ready before PartyKit syncs.
  const [showSkeleton, setShowSkeleton] = useState(false);
  const isStillLoading = isNew
    ? !ydoc || !provider
    : isLoading || !isReady || !ydoc || !provider;

  useEffect(() => {
    setShowSkeleton(false);

    if (!isStillLoading || isNew) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isStillLoading, isNew, documentId]);

  // === RENDERING LOGIC ===

  // 1. Fatal errors (no access, missing doc, real sign-out) replace the editor.
  // Connection drops do not — they keep the local Y.Doc and show a banner.
  if (error) {
    const { title, message } = getDocumentErrorContent(error);
    return (
      <MotionFade>
        <Alert variant="destructive">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </MotionFade>
    );
  }

  // 2. Ready editor: keep it mounted while reconnecting so typing is not lost.
  if (ydoc && provider && isReady) {
    const userName = userProfile
      ? [userProfile.first_name, userProfile.last_name]
          .filter(
            (p): p is string => typeof p === "string" && p.trim().length > 0,
          )
          .join(" ")
          .trim() || "Anonymous User"
      : "Anonymous User";
    const userColor = getAvatarColorHex(
      userProfile?.default_avatar_background_color,
    );

    return (
      <MotionFade>
        <div className="flex flex-col gap-3">
          {isReconnecting && (
            <ConnectionLostNotice onRetry={retryConnection} keepEditing />
          )}
          <Editor
            userName={userName}
            userColor={userColor}
            ydoc={ydoc}
            provider={provider}
          />
        </div>
      </MotionFade>
    );
  }

  // 3. Never painted: a dropped socket should not look like a missing login.
  if (isReconnecting) {
    return (
      <MotionFade>
        <ConnectionLostNotice onRetry={retryConnection} keepEditing={false} />
      </MotionFade>
    );
  }

  // 4. Still loading — new docs stay blank (no skeleton). Existing docs
  // show a skeleton only after the delay to avoid flicker on fast loads.
  if (isStillLoading || !ydoc || !provider) {
    if (!isNew && showSkeleton) {
      return (
        <MotionFade>
          <DocumentLoadingSkeleton />
        </MotionFade>
      );
    }
    return null;
  }

  return null;
}
