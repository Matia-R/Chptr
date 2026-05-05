"use client";

import {
  Check,
  CloudUpload,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  Loader2,
  Trash2,
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

  const hasSomethingUnpublished = hasUnpublishedChanges || hasPendingSlugChange;

  return (
    <>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Publish to the web
        </h2>
        <p className="text-sm text-muted-foreground">
          Share your article with the world.
        </p>
      </div>

      {showPublishedPopoverActions && pub ? (
        <section
          className="flex flex-col gap-4"
          aria-label="Published article status"
        >
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex w-full items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-background"
                  aria-hidden
                />
                <span>Live · {formatPublicationDate(pub.updated_at)}</span>
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
            {hasSomethingUnpublished ? (
              <p className="pl-3.5 text-xs text-muted-foreground">
                Unpublished changes
              </p>
            ) : null}
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
    hasPendingSlugChange,
    hasUnpublishedChanges: docHasUnpublishedChanges,
  } = ctx;

  if (!documentId) return null;

  const hasSomethingUnpublished =
    docHasUnpublishedChanges || hasPendingSlugChange;

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

  const sectionTitle = (
    <p className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
      Publish
    </p>
  );

  const pub = publication;

  if (showPublishedPopoverActions && pub) {
    return (
      <div className="flex flex-col gap-3 px-4 pb-8 pt-1">
        {sectionTitle}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-background"
              aria-hidden
            />
            Live · {formatPublicationDate(pub.updated_at)}
          </span>
          {hasSomethingUnpublished ? (
            <span className="text-amber-700 dark:text-amber-400">
              Unpublished changes
            </span>
          ) : null}
        </p>

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
            icon={Trash2}
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
      {sectionTitle}
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
