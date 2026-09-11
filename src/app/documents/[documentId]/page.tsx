"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/app/_components/alert";
import { DocumentLoadingSkeleton } from "~/app/_components/document-loading-skeleton";
import { MotionFade } from "~/app/_components/motion-fade";
import { SAVE_FEEDBACK_CONTENT_TRANSITION } from "~/app/_components/save-feedback-label";
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

function ConnectionBanner({ isOffline }: { isOffline: boolean }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
      className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center px-4 md:top-16"
    >
      <p className="flex items-center gap-2 rounded-full border bg-sidebar px-4 py-2.5 text-sm text-foreground shadow-sm">
        {isOffline ? (
          <CloudOff className="size-4 shrink-0" aria-hidden />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        )}
        {isOffline
          ? "You’re offline. Editing is paused."
          : "Reconnecting. Editing is paused."}
      </p>
    </motion.div>
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
    isOffline,
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

  // 2. Ready editor: keep it mounted so the doc stays visible, but lock
  // editing until the socket is back. Offline editing is not shipped yet.
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
        <AnimatePresence>
          {isReconnecting ? (
            <ConnectionBanner
              key={isOffline ? "offline-banner" : "reconnect-banner"}
              isOffline={isOffline}
            />
          ) : null}
        </AnimatePresence>
        <Editor
          userName={userName}
          userColor={userColor}
          ydoc={ydoc}
          provider={provider}
          editable={!isReconnecting}
        />
      </MotionFade>
    );
  }

  // 3. Never painted: a dropped socket should not look like a missing login.
  if (isReconnecting) {
    return (
      <MotionFade>
        <AnimatePresence>
          <ConnectionBanner
            key={isOffline ? "offline-banner" : "reconnect-banner"}
            isOffline={isOffline}
          />
        </AnimatePresence>
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
