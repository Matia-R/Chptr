"use client";

import { memo } from "react";

import "~/app/_components/article/article.css";

import { PublishedDocumentView } from "~/app/_components/published-document-view";
import { authorInitials } from "~/lib/published-author";
import type { OnboardingStep } from "~/lib/onboarding";
import { cn } from "~/lib/utils";

export const SAMPLE_ARTICLE_TITLE = "The Art of Paying Attention";
const SAMPLE_PUBLISHED_AT = "2026-03-12T15:00:00.000Z";
const NAME_PLACEHOLDER = "Your author name";

/** Temporary onboarding emphasis. Horizontal padding is cancelled so the line doesn't shift. */
const EMPHASIS =
  "rounded-md bg-foreground/[0.06] px-1.5 -mx-1.5 ring-1 ring-foreground/10";

const EMPHASIS_TRANSITION =
  "transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none";

const AVATAR_EMPHASIS =
  "ring-2 ring-foreground/15 ring-offset-2 ring-offset-background";

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

export function OnboardingArticlePreview({
  step,
  authorName,
  handle,
  avatarUrl,
  defaultAvatarColor,
  variant,
}: {
  step: OnboardingStep;
  authorName: string;
  handle: string;
  avatarUrl: string | null;
  defaultAvatarColor: string;
  variant: "desktop" | "compact";
}) {
  const trimmedName = authorName.trim();
  const hasName = trimmedName.length > 0;
  const displayName = hasName ? trimmedName : NAME_PLACEHOLDER;
  const handleValue = previewHandle(handle);

  return (
    <div
      className={cn(
        "pointer-events-none relative overflow-hidden bg-background",
        variant === "desktop" ? "h-full" : "h-64",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-x-0",
          variant === "desktop"
            ? "top-1/2 -translate-y-[42%]"
            : "top-0 [&_header]:hidden",
        )}
      >
        <PublishedDocumentView
          title={SAMPLE_ARTICLE_TITLE}
          ownerUsername={handleValue}
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
          compact={variant === "compact"}
          embedded
          className="min-h-0 bg-background"
          authorNameClassName={cn(
            EMPHASIS_TRANSITION,
            !hasName && "font-normal text-muted-foreground",
            step === "name" && EMPHASIS,
          )}
          avatarClassName={cn(
            "transition-[box-shadow] duration-200 ease-out motion-reduce:transition-none",
            step === "avatar" && AVATAR_EMPHASIS,
          )}
        >
          <SampleBody />
        </PublishedDocumentView>
      </div>
    </div>
  );
}
