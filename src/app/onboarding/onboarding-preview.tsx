"use client";

import { useReducedMotion } from "framer-motion";
import { memo, useLayoutEffect, useRef, useState } from "react";

import "~/app/_components/article/article.css";
import "./onboarding-preview.css";

import { PublishedDocumentView } from "~/app/_components/published-document-view";
import { authorInitials } from "~/lib/published-author";
import { cn } from "~/lib/utils";

export const SAMPLE_ARTICLE_TITLE = "The Art of Paying Attention";
const SAMPLE_PUBLISHED_AT = "2026-03-12T15:00:00.000Z";
const NAME_PLACEHOLDER = "Your author name";

const BODY_FADE =
  "linear-gradient(to bottom, #000 0%, #000 8%, transparent 62%)";

const SampleBody = memo(function SampleBody() {
  return (
    <div
      style={{
        maskImage: BODY_FADE,
        WebkitMaskImage: BODY_FADE,
      }}
    >
      <div className="article-block">
        <p>
          Most of what we call attention is a decision about what to ignore. The
          rest of the day arrives anyway.
        </p>
      </div>
      <div className="article-block">
        <p>
          A published article carries the author&apos;s name beside the work.
          The sentences underneath are just the work itself.
        </p>
      </div>
      <div className="article-block">
        <p>
          Readers meet you here first: a name, a face, and the address where the
          writing lives.
        </p>
      </div>
    </div>
  );
});

function previewHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

const PATH_MOTION_MS = 320;

function usePreviewPath(showPath: boolean) {
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion === true);
  reduceMotionRef.current = reduceMotion === true;
  const revealed = useRef(showPath);
  const [present, setPresent] = useState(showPath);
  const [motionOn, setMotionOn] = useState(false);
  const [open, setOpen] = useState(showPath);

  useLayoutEffect(() => {
    if (showPath) {
      const shouldAnimate = !revealed.current;
      revealed.current = true;
      if (!shouldAnimate) return;

      setPresent(true);
      setOpen(false);
      setMotionOn(false);
      if (reduceMotionRef.current) {
        setOpen(true);
        return;
      }

      let startFrame = 0;
      const armFrame = window.requestAnimationFrame(() => {
        setMotionOn(true);
        startFrame = window.requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        window.cancelAnimationFrame(armFrame);
        window.cancelAnimationFrame(startFrame);
      };
    }

    if (!revealed.current) return;
    revealed.current = false;
    setMotionOn(true);
    setOpen(false);
    const timeout = window.setTimeout(
      () => {
        setPresent(false);
        setMotionOn(false);
      },
      reduceMotionRef.current ? 0 : PATH_MOTION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [showPath]);

  return { present, motionOn, open };
}

export function OnboardingArticlePreview({
  authorName,
  handle,
  avatarUrl,
  defaultAvatarColor,
  showPath = false,
}: {
  authorName: string;
  handle: string;
  avatarUrl: string | null;
  defaultAvatarColor: string;
  /** Keeps the path collapsed until the link step. */
  showPath?: boolean;
}) {
  const trimmedName = authorName.trim();
  const hasName = trimmedName.length > 0;
  const displayName = hasName ? trimmedName : NAME_PLACEHOLDER;
  const handleValue = previewHandle(handle);
  const path = usePreviewPath(showPath);

  const article = (
    <PublishedDocumentView
      title={SAMPLE_ARTICLE_TITLE}
      ownerUsername={path.present ? handleValue : ""}
      publishedAt={SAMPLE_PUBLISHED_AT}
      authorProfile={{
        username: handleValue,
        author_name: displayName,
        avatar_url: avatarUrl,
        default_avatar_background_color: defaultAvatarColor,
        first_name: null,
        last_name: null,
      }}
      initials={authorInitials(hasName ? trimmedName : "")}
      embedded
      className={cn(
        "onboarding-preview-article min-h-0 bg-background [&_header]:border-b-0",
        path.motionOn && "onboarding-path-motion",
        path.open && "onboarding-path-open",
      )}
      authorNameClassName={
        !hasName ? "font-normal text-muted-foreground" : undefined
      }
    >
      <SampleBody />
    </PublishedDocumentView>
  );

  return (
    <div
      className="pointer-events-none relative h-full overflow-hidden bg-background"
      aria-hidden
    >
      <div className="absolute inset-x-6 top-1/2 -translate-y-[42%] xl:inset-x-8">
        <div className="relative isolate">
          <div className="absolute inset-x-0 top-0 -z-10 h-[calc(100%+100dvh)] rounded-t-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]" />
          <div className="overflow-hidden rounded-t-2xl border-x border-t border-border bg-background pt-4 md:[&_.document-type>section]:pt-10">
            {article}
          </div>
          <div className="absolute inset-x-0 top-[calc(100%-1px)] h-dvh border-x border-border bg-background" />
        </div>
      </div>
    </div>
  );
}
