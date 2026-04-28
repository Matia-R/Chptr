"use client";

/**
 * tRPC React hooks are fully typed via `AppRouter`, but `@typescript-eslint/no-unsafe-*`
 * can still report spurious “error typed value” on `api.*` in some IDE ESLint integrations.
 * `tsc` and `eslint` (CLI) validate this file cleanly.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- tRPC React Query hooks */

import {
  Check,
  ChevronDown,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "~/app/_components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { Input } from "~/app/_components/input";
import { useToast } from "~/hooks/use-toast";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { slugifyTitle } from "~/lib/slug";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

import { useDocumentEditorStore } from "./document-editor-store";
import type { AppBlockNoteEditor } from "./editor-types";

type PublishDocumentResult = RouterOutputs["document"]["publishDocument"];
type PublishFeedbackState = "idle" | "publishing" | "published";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shown host only (no protocol); matches public URL shape. */
const LIVE_HOST_DISPLAY = "chptr.io";

const MAX_USERNAME_DISPLAY_CHARS = 10;

/** Same truncation as the “Live at” link: full username or `...` when longer than 10 chars. */
function formatUsernameSegmentForDisplay(username: string): string {
  return username.length <= MAX_USERNAME_DISPLAY_CHARS ? username : "...";
}

/** Same pattern as `PublishedDocumentTitleSection` (short month, day, year). */
function formatPublicationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function DocumentPublishButton() {
  const params = useParams();
  const documentId = params.documentId as string | undefined;
  const editor = useDocumentEditorStore((s) => s.editor);
  const { isNew } = useNewDocumentFlag();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [slugOverride, setSlugOverride] = useState("");
  const [publishFeedback, setPublishFeedback] =
    useState<PublishFeedbackState>("idle");

  const { data: docMeta } = api.document.getDocumentById.useQuery(
    documentId ?? "",
    {
      enabled: !!documentId && !isNew,
    },
  );

  const { data: publication, isLoading: publicationLoading } =
    api.document.getPublicationByDocumentId.useQuery(documentId ?? "", {
      enabled: !!documentId && !isNew,
    });

  const { data: ownerPathData } =
    api.document.getPublicationOwnerPathSegment.useQuery(documentId ?? "", {
      enabled: !!documentId && !isNew && !publication,
    });

  const utils = api.useUtils();

  const publishMutation = api.document.publishDocument.useMutation({
    onSuccess: (result: PublishDocumentResult) => {
      if (documentId) {
        void utils.document.getPublicationByDocumentId.invalidate(documentId);
        void utils.document.getDocumentById.invalidate(documentId);
      }

      toast({
        title: "Changes published",
        description: (
          <span>
            Live at{" "}
            <Link
              href={result.publicPath}
              className="font-medium underline underline-offset-2"
            >
              {result.publicPath}
            </Link>
          </span>
        ),
      });
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: getErrorMessage(err),
      });
    },
  });

  const unpublishMutation = api.document.unpublishDocument.useMutation({
    onSuccess: () => {
      if (documentId) {
        void utils.document.getPublicationByDocumentId.invalidate(documentId);
      }
      toast({ title: "Removed public page" });
      setOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Unpublish failed",
        description: getErrorMessage(err),
      });
    },
  });

  const nameTrim = docMeta?.document?.name?.trim();
  const title = nameTrim && nameTrim.length > 0 ? nameTrim : "Untitled";

  const ownerPreview =
    publication?.owner_username ?? ownerPathData?.ownerSegment ?? null;
  const slugPlaceholder =
    publication && !slugOverride.trim()
      ? publication.slug
      : slugifyTitle(title);
  const urlPrefixDisplay =
    ownerPreview != null
      ? `${LIVE_HOST_DISPLAY}/${formatUsernameSegmentForDisplay(ownerPreview)}/`
      : `${LIVE_HOST_DISPLAY}/…/`;
  const urlPrefixTitle =
    ownerPreview != null ? `${LIVE_HOST_DISPLAY}/${ownerPreview}/` : undefined;

  /** Slug segment for the public path preview (matches what will be live after publish/update). */
  const previewSlugSegment = slugOverride.trim()
    ? slugifyTitle(slugOverride)
    : publication
      ? publication.slug
      : slugifyTitle(title);

  const docLastUpdated = docMeta?.document?.last_updated;
  const hasUnpublishedChanges =
    !!publication &&
    !!docLastUpdated &&
    new Date(docLastUpdated).getTime() >
      new Date(publication.updated_at).getTime();

  /** `publication` is undefined while loading, `null` when never published, else a row. */
  const hasChangesToPublish =
    !publicationLoading && (publication === null || hasUnpublishedChanges);
  const primaryTriggerLabel = publicationLoading
    ? "Loading…"
    : hasChangesToPublish
      ? "Publish changes"
      : "Up to date";

  const busy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    publishFeedback === "publishing";

  const publishButtonLabel =
    publishFeedback === "publishing"
      ? "Publishing..."
      : publishFeedback === "published"
        ? "Published"
        : primaryTriggerLabel;

  const publishButtonIcon =
    publishFeedback === "publishing" ? (
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
    ) : publishFeedback === "published" ? (
      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
    ) : null;

  if (isNew || !documentId) return null;

  const handlePublish = async () => {
    if (!editor || !documentId) {
      toast({
        variant: "destructive",
        title: "Editor not ready",
        description: "Wait for the document to finish loading.",
      });
      return;
    }

    setPublishFeedback("publishing");

    try {
      const bodyHtml = await blockNoteEditorToExportHtml(editor);
      const blocksJson = JSON.stringify(editor.document);

      await Promise.all([
        publishMutation.mutateAsync({
          documentId,
          title,
          bodyHtml,
          blocksJson,
          slug: slugOverride.trim() || undefined,
        }),
        sleep(500),
      ]);

      setPublishFeedback("published");

      window.setTimeout(() => {
        setPublishFeedback("idle");
      }, 1400);

      window.setTimeout(() => {
        setOpen(false);
      }, 800);
    } catch (e) {
      setPublishFeedback("idle");

      toast({
        variant: "destructive",
        title: "Could not publish",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const urlSlugCluster = (
    <>
      {/* <Label htmlFor="publish-slug">Title in URL</Label> */}
      <div
        className={cn(
          "flex min-h-9 w-full items-stretch overflow-hidden rounded-md border shadow-sm",
          "border-input bg-transparent",
          /* Dark: dialog is bg-sidebar — input/muted borders vanish; use darker inset + visible border */
          "dark:border-sidebar-border dark:bg-background dark:shadow-[inset_0_1px_0_0_hsl(0_0%_100%_/_0.06)]",
          "focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center border-r px-2 py-1.5 text-xs sm:text-sm",
            "border-input bg-muted/40 text-muted-foreground",
            /* Lighter strip vs slug area so prefix vs editable reads clearly */
            "dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground/70",
          )}
          title={urlPrefixTitle}
          aria-hidden
        >
          {urlPrefixDisplay}
        </span>
        <Input
          id="publish-slug"
          className={cn(
            "h-9 min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sidebar-foreground shadow-none focus-visible:ring-0",
            publication ? "rounded-none" : "rounded-r-md",
          )}
          placeholder={slugPlaceholder}
          value={slugOverride}
          onChange={(e) => {
            setSlugOverride(e.target.value.replace(/\s+/g, "-"));
          }}
          disabled={busy}
        />
        {publication ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy || !ownerPreview}
            title="Copy public link"
            className="h-9 w-9 shrink-0 rounded-none rounded-r-md border-l border-input text-muted-foreground transition-colors hover:text-foreground dark:border-sidebar-border"
            onClick={async () => {
              if (!ownerPreview) return;
              const url = new URL(
                `/${ownerPreview}/${previewSlugSegment}`,
                window.location.origin,
              ).href;
              try {
                await navigator.clipboard.writeText(url);
                toast({ title: "Copied to clipboard" });
              } catch {
                toast({
                  variant: "destructive",
                  title: "Could not copy",
                  description: "Try again or copy the link manually.",
                });
              }
            }}
          >
            <LinkIcon className="h-4 w-4" aria-hidden />
            <span className="sr-only">Copy public link</span>
          </Button>
        ) : null}
      </div>
      {!ownerPreview && (
        <p className="text-xs text-muted-foreground">
          Add a username in Account to use your real URL path.
        </p>
      )}
    </>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSlugOverride("");
      }}
    >
      <div
        className="inline-flex max-w-full shrink-0 items-stretch overflow-hidden rounded-sm border border-input bg-background transition-shadow duration-200 ease-out"
        title={
          !editor
            ? "Loading editor…"
            : publication
              ? "Published — publish from the left or open options on the right"
              : "Publish to web — publish from the left or open options on the right"
        }
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            /* Match title control padding/size: py-1 px-2 text-sm rounded-sm */
            "h-auto min-h-0 w-[120px] rounded-none py-1 pl-2 pr-2 text-sm shadow-none",
            "shrink-0 whitespace-nowrap",
            "transition-all duration-200 ease-out active:scale-[0.98]",
            !hasChangesToPublish &&
              publication &&
              publishFeedback === "idle" &&
              "text-muted-foreground",
          )}
          disabled={
            !editor ||
            busy ||
            publicationLoading ||
            (!hasChangesToPublish && publishFeedback === "idle")
          }
          onClick={() => {
            void handlePublish();
          }}
        >
          <span className="inline-flex items-center gap-1.5 transition-all duration-150">
            {publishButtonIcon}
            <span>{publishButtonLabel}</span>
          </span>
        </Button>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-auto min-h-0 shrink-0 rounded-none border-l border-input py-1 pl-1 pr-1.5 text-sm shadow-none",
              "transition-colors duration-150",
            )}
            disabled={!editor || publishFeedback === "publishing"}
            aria-label="Open publish options"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "relative w-[min(100vw-2rem,28rem)] max-w-md border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground shadow-lg",
          "grid gap-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        )}
      >
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Publish to the web
          </h2>
          <p className="text-sm text-muted-foreground">
            Share your article with the world.
          </p>
        </div>

        {publication ? (
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
                  <span>
                    Live · {formatPublicationDate(publication.updated_at)}
                  </span>
                </p>
                <Link
                  href={`/${publication.owner_username}/${publication.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  View article
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </div>
              {hasUnpublishedChanges ? (
                <p className="pl-3.5 text-xs text-muted-foreground">
                  Unpublished changes
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">{urlSlugCluster}</div>
          </section>
        ) : (
          <div className="grid gap-2">{urlSlugCluster}</div>
        )}

        {publication ? (
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || publicationLoading}
              className="min-w-0 flex-1 !px-4 transition-all duration-200 ease-out active:scale-[0.98]"
              onClick={() => {
                if (documentId) {
                  unpublishMutation.mutate(documentId);
                }
              }}
            >
              {unpublishMutation.isPending ? (
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
                    : "Publish Changes"}
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
      </PopoverContent>
    </Popover>
  );
}

async function blockNoteEditorToExportHtml(
  editor: AppBlockNoteEditor,
): Promise<string> {
  return editor.blocksToFullHTML(editor.document);
}
