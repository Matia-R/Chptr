"use client";

/**
 * tRPC React hooks are fully typed via `AppRouter`, but `@typescript-eslint/no-unsafe-*`
 * can still report spurious “error typed value” on `api.*` in some IDE ESLint integrations.
 * `tsc` and `eslint` (CLI) validate this file cleanly.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- tRPC React Query hooks */

import { Copy, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import { useToast } from "~/hooks/use-toast";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { slugifyTitle } from "~/lib/slug";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

import { useDocumentEditorStore } from "./document-editor-store";
import type { AppBlockNoteEditor } from "./editor-types";

type PublishDocumentResult = RouterOutputs["document"]["publishDocument"];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

/** Shown host only (no protocol); matches public URL shape. */
const LIVE_HOST_DISPLAY = "chptr.io";

const MAX_USERNAME_DISPLAY_CHARS = 10;

/** Same truncation as the “Live at” link: full username or `...` when longer than 10 chars. */
function formatUsernameSegmentForDisplay(username: string): string {
  return username.length <= MAX_USERNAME_DISPLAY_CHARS ? username : "...";
}

/**
 * Renders like `chptr.io/.../doc-slug` when the username is long; otherwise full username.
 */
function formatLiveUrlForDisplay(username: string, slug: string): string {
  const userPart = formatUsernameSegmentForDisplay(username);
  return `${LIVE_HOST_DISPLAY}/${userPart}/${slug}`;
}

export function DocumentPublishButton() {
  const params = useParams();
  const documentId = params.documentId as string | undefined;
  const editor = useDocumentEditorStore((s) => s.editor);
  const { isNew } = useNewDocumentFlag();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [slugOverride, setSlugOverride] = useState("");

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
      }
      toast({
        title: "Published",
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
      setOpen(false);
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

  if (isNew || !documentId) return null;

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

  const handlePublish = async () => {
    if (!editor || !documentId) {
      toast({
        variant: "destructive",
        title: "Editor not ready",
        description: "Wait for the document to finish loading.",
      });
      return;
    }
    try {
      const bodyHtml = await blockNoteEditorToExportHtml(editor);
      const blocksJson = JSON.stringify(editor.document);
      publishMutation.mutate({
        documentId,
        title,
        bodyHtml,
        blocksJson,
        slug: slugOverride.trim() || undefined,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not export document",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const busy = publishMutation.isPending || unpublishMutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 shrink-0"
        disabled={!editor}
        title={
          !editor
            ? "Loading editor…"
            : publication
              ? "Published — manage sharing"
              : "Publish to web"
        }
        onClick={() => {
          setSlugOverride("");
          setOpen(true);
        }}
      >
        <span className="sr-only">
          {publication
            ? "Document is published. Open sharing options."
            : "Publish to web."}
        </span>
        <Globe className="h-4 w-4" aria-hidden />
        {publication && !!editor ? (
          <span
            className="motion-safe:duration-[650ms] pointer-events-none absolute right-[5px] top-[5px] size-1.5 rounded-full bg-emerald-500 ring-2 ring-background motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
            aria-hidden
          />
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish to the web</DialogTitle>
            <DialogDescription>
              Share your article with the world.
            </DialogDescription>
          </DialogHeader>

          {publication && (
            <div className="text-sm">
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-background"
                  aria-hidden
                />
                <p className="text-muted-foreground">Live at:</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${publication.owner_username}/${publication.slug}`}
                  className="min-w-0 break-words font-medium text-foreground underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${LIVE_HOST_DISPLAY}/${publication.owner_username}/${publication.slug}`}
                >
                  {formatLiveUrlForDisplay(
                    publication.owner_username,
                    publication.slug,
                  )}
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Copy link"
                  onClick={async () => {
                    const url = new URL(
                      `/${publication.owner_username}/${publication.slug}`,
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
                  <Copy className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Copy link</span>
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="publish-slug">Title in URL</Label>
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
                    "inline-flex shrink-0 items-center border-r px-2 py-1.5 font-mono text-xs sm:text-sm",
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
                  className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 py-1 text-sidebar-foreground shadow-none focus-visible:ring-0"
                  placeholder={slugPlaceholder}
                  value={slugOverride}
                  onChange={(e) => {
                    setSlugOverride(e.target.value.replace(/\s+/g, "-"));
                  }}
                  disabled={busy}
                />
              </div>
              {!ownerPreview && (
                <p className="text-xs text-muted-foreground">
                  Add a username in Account to use your real URL path.
                </p>
              )}
            </div>
          </div>

          <DialogFooter
            className={cn(
              "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:gap-3 sm:space-x-0",
              publication ? "sm:justify-between" : "sm:justify-end",
            )}
          >
            {publication ? (
              <Button
                type="button"
                variant="ghostText"
                disabled={busy || publicationLoading}
                className="self-start text-destructive/75 hover:!text-destructive sm:self-center"
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
            ) : null}
            <div className="flex w-full flex-row justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !editor}
                onClick={() => {
                  void handlePublish();
                }}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : publication ? (
                  "Update"
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function blockNoteEditorToExportHtml(
  editor: AppBlockNoteEditor,
): Promise<string> {
  return editor.blocksToFullHTML(editor.document);
}
