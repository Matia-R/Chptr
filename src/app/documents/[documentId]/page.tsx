"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { TRPCClientError } from "@trpc/client";
import { Alert, AlertDescription, AlertTitle } from "~/app/_components/alert";
import { DocumentLoadingSkeleton } from "~/app/_components/document-loading-skeleton";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCollaborativeDocCrdt } from "~/hooks/use-collaborative-doc-crdt";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useUserProfile } from "~/hooks/use-user-profile";
import { getAvatarColorHex } from "~/lib/avatar-colors";

const DOCUMENT_ERROR = {
  NOT_FOUND: {
    title: "Document Not Found",
    message: "This document doesn't exist or the link may be incorrect.",
  },
  BAD_REQUEST: {
    title: "Invalid Link",
    message: "The document link is invalid. Please check the URL.",
  },
  FORBIDDEN: {
    title: "Access Denied",
    message: "You don't have permission to view this document.",
  },
  UNAUTHORIZED: {
    title: "Access Denied",
    message: "You don't have permission to view this document.",
  },
  INTERNAL_SERVER_ERROR: {
    title: "Unable to Load Document",
    message: "Something went wrong on our end. Please try again.",
  },
  DEFAULT: {
    title: "Unable to Load Document",
    message: "Something unexpected happened. Please try refreshing.",
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

  // 2. Show loading skeleton (CRDT loading or provider not ready)
  if (
    !isNew &&
    (isLoading || !isReady || !ydoc || !provider || isProfileLoading)
  ) {
    return (
      <MotionFade>
        <DocumentLoadingSkeleton />
      </MotionFade>
    );
  }

  // 3. Still waiting for ydoc/provider (e.g. optimistic new-doc case)
  if (!isReady || !ydoc || !provider || isProfileLoading) {
    return (
      <MotionFade>
        <DocumentLoadingSkeleton />
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
