"use client";

import {
  Check,
  CloudUpload,
  ExternalLink,
  Globe,
  GlobeOff,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "~/app/_components/button";
import { cn } from "~/lib/utils";

import {
  MobileActionButtonRow,
  MobileActionExpandingRow,
  MobileActionGroup,
  MobileActionLinkRow,
} from "~/app/_components/mobile-action-rows";
import { useDocumentPublish } from "~/hooks/use-document-publish";

function formatPublicationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Desktop publish popover body. Render inside `<PopoverContent className="grid gap-6 …">`. */
export function DocumentPublishPopoverPanel() {
  const ctx = useDocumentPublish();
  if (!ctx) return null;

  const {
    documentId,
    editor,
    busy,
    publicationLoading,
    publication,
    publishFeedback,
    handlePublish,
    hasChangesToPublish,
    showPublishedPopoverActions,
    hasUnpublishedChanges,
    hasPendingSlugChange,
    buildUrlSlugCluster,
    unpublish,
    unpublishPending,
  } = ctx;

  const pub = publication;
  if (!documentId) return null;

  const isOutOfDate = hasUnpublishedChanges || hasPendingSlugChange;

  return (
    <>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Publish
        </h2>
      </div>

      {showPublishedPopoverActions && pub ? (
        <section
          className="flex flex-col gap-4"
          aria-label="Published article status"
        >
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex w-full items-start justify-between gap-3">
              <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full ring-2 ring-background",
                    isOutOfDate ? "bg-amber-500" : "bg-emerald-500",
                  )}
                  aria-hidden
                />
                <span>
                  Live · {formatPublicationDate(pub.updated_at)}
                  {isOutOfDate ? " · Out of date" : ""}
                </span>
              </p>
              <Link
                href={`/${pub.owner_username}/${pub.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                View article
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="grid gap-2">{buildUrlSlugCluster("popover")}</div>
        </section>
      ) : (
        <div className="grid gap-2">{buildUrlSlugCluster("popover")}</div>
      )}

      {showPublishedPopoverActions ? (
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || publicationLoading}
            className="min-w-0 flex-1 !px-4 transition-all duration-200 ease-out active:scale-[0.98]"
            onClick={unpublish}
          >
            {unpublishPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Unpublish"
            )}
          </Button>
          <Button
            type="button"
            className={cn(
              "min-w-0 flex-1 transition-all duration-200 ease-out active:scale-[0.98]",
            )}
            disabled={
              busy ||
              !editor ||
              publicationLoading ||
              (!hasChangesToPublish && publishFeedback === "idle")
            }
            onClick={() => {
              void handlePublish();
            }}
          >
            <span className="inline-flex items-center gap-2">
              {publishFeedback === "publishing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : publishFeedback === "published" ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : null}
              {publishFeedback === "publishing"
                ? "Publishing..."
                : publishFeedback === "published"
                  ? "Published"
                  : hasChangesToPublish
                    ? "Publish changes"
                    : "Up to date"}
            </span>
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className={cn(
            "w-full transition-all duration-200 ease-out active:scale-[0.98]",
          )}
          disabled={busy || !editor}
          onClick={() => {
            void handlePublish();
          }}
        >
          <span className="inline-flex items-center gap-2">
            {publishFeedback === "publishing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : publishFeedback === "published" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : null}
            {publishFeedback === "publishing"
              ? "Publishing..."
              : publishFeedback === "published"
                ? "Published"
                : "Publish"}
          </span>
        </Button>
      )}
    </>
  );
}

/** Mobile actions drawer: publish section (grouped rows). */
export function DocumentPublishMobileDrawerPanel() {
  const ctx = useDocumentPublish();
  const [slugRowExpanded, setSlugRowExpanded] = useState(false);

  useEffect(() => {
    if (!ctx?.mobileDrawerOpen) setSlugRowExpanded(false);
  }, [ctx?.mobileDrawerOpen]);

  useEffect(() => {
    if (!slugRowExpanded) return;
    requestAnimationFrame(() => {
      document.getElementById("publish-slug-mobile")?.focus();
    });
  }, [slugRowExpanded]);

  if (!ctx) return null;

  const {
    documentId,
    editor,
    busy,
    publicationLoading,
    publication,
    publishFeedback,
    handlePublish,
    hasChangesToPublish,
    showPublishedPopoverActions,
    ownerPreview,
    copyPublicUrl,
    buildUrlSlugCluster,
    unpublish,
    unpublishPending,
  } = ctx;

  if (!documentId) return null;

  const publishRowLabel =
    publishFeedback === "publishing"
      ? "Publishing..."
      : publishFeedback === "published"
        ? "Published"
        : showPublishedPopoverActions
          ? hasChangesToPublish
            ? "Publish changes"
            : "Up to date"
          : "Publish";

  const publishIcon = publishFeedback === "publishing" ? Loader2 : CloudUpload;

  const pub = publication;

  if (showPublishedPopoverActions && pub) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-8 pt-1">
        <MobileActionGroup>
          <MobileActionLinkRow
            icon={ExternalLink}
            label="View article"
            href={`/${pub.owner_username}/${pub.slug}`}
          />
          <MobileActionButtonRow
            icon={LinkIcon}
            label="Copy link"
            disabled={busy || !ownerPreview}
            onClick={() => {
              void copyPublicUrl();
            }}
          />
          <MobileActionExpandingRow
            icon={Globe}
            label="Edit URL"
            expanded={slugRowExpanded}
            onToggle={() => setSlugRowExpanded((open) => !open)}
          >
            {buildUrlSlugCluster("mobile")}
          </MobileActionExpandingRow>
        </MobileActionGroup>

        {!ownerPreview ? (
          <p className="px-1 text-xs text-muted-foreground">
            Add a username in Account to use your real URL path.
          </p>
        ) : null}

        <MobileActionGroup>
          <MobileActionButtonRow
            icon={publishIcon}
            iconClassName={
              publishFeedback === "publishing" ? "animate-spin" : undefined
            }
            label={publishRowLabel}
            disabled={
              busy ||
              !editor ||
              publicationLoading ||
              (!hasChangesToPublish && publishFeedback === "idle")
            }
            onClick={() => {
              void handlePublish();
            }}
          />
        </MobileActionGroup>

        <MobileActionGroup>
          <MobileActionButtonRow
            icon={GlobeOff}
            label="Unpublish"
            destructive
            disabled={busy || publicationLoading}
            trailing={
              unpublishPending ? (
                <Loader2
                  className="size-4 animate-spin opacity-70"
                  aria-hidden
                />
              ) : undefined
            }
            onClick={unpublish}
          />
        </MobileActionGroup>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-1">
      <MobileActionGroup>
        <MobileActionExpandingRow
          icon={Globe}
          label="Edit URL"
          expanded={slugRowExpanded}
          onToggle={() => setSlugRowExpanded((open) => !open)}
        >
          {buildUrlSlugCluster("mobile")}
        </MobileActionExpandingRow>
      </MobileActionGroup>
      {!ownerPreview ? (
        <p className="px-1 text-xs text-muted-foreground">
          Add a username in Account to use your real URL path.
        </p>
      ) : null}
      <MobileActionGroup>
        <MobileActionButtonRow
          icon={publishIcon}
          iconClassName={
            publishFeedback === "publishing" ? "animate-spin" : undefined
          }
          label={publishRowLabel}
          disabled={busy || !editor}
          onClick={() => {
            void handlePublish();
          }}
        />
      </MobileActionGroup>
    </div>
  );
}
