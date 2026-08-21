"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { Alert, AlertDescription, AlertTitle } from "~/app/_components/alert";
import { DocumentLoadingSkeleton } from "~/app/_components/document-loading-skeleton";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCollaborativeDocPartykit } from "~/hooks/use-collaborative-doc-partykit";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useUserProfile } from "~/hooks/use-user-profile";
import { getAvatarColorHex } from "~/lib/avatar-colors";

const SKELETON_DELAY_MS = 250;

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

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof TRPCClientError) {
    return (error.data as { code?: string } | undefined)?.code;
  }
  if (error instanceof Error && error.cause instanceof TRPCClientError) {
    return (error.cause.data as { code?: string } | undefined)?.code;
  }
  return undefined;
}

function getDocumentErrorContent(error: unknown): {
  title: string;
  message: string;
} {
  const code = getErrorCode(error);
  const key: keyof typeof DOCUMENT_ERROR =
    code && code in DOCUMENT_ERROR
      ? (code as keyof typeof DOCUMENT_ERROR)
      : "DEFAULT";
  return DOCUMENT_ERROR[key];
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
  const { ydoc, provider, isReady, isLoading, error } = useCollaborativeDocPartykit(
    {
      documentId,
      isNew,
    },
  );

  // Delayed skeleton: only show after SKELETON_DELAY_MS to avoid flicker on fast loads
  const [showSkeleton, setShowSkeleton] = useState(false);
  const isStillLoading = isLoading || !isReady || !ydoc || !provider;

  useEffect(() => {
    if (!isStillLoading) {
      // Loading complete, reset skeleton state
      setShowSkeleton(false);
      return;
    }

    // Start timer to show skeleton after delay
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, SKELETON_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isStillLoading]);

  // === RENDERING LOGIC ===

  // 1. Handle errors — show alert and stop; don't proceed to loading or editor
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

  // 2. Still loading — show skeleton only after delay to avoid flicker
  if (isStillLoading) {
    if (showSkeleton) {
      return (
        <MotionFade>
          <DocumentLoadingSkeleton />
        </MotionFade>
      );
    }
    // Before delay: show nothing (feels instant for fast loads)
    return null;
  }

  // 3. Ready to render
  const userName = userProfile
    ? [userProfile.first_name, userProfile.last_name]
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .join(" ")
        .trim() || "Anonymous User"
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
