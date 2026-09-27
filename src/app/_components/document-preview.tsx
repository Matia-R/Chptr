"use client";

import "~/app/_components/article/article.css";
import "~/app/[username]/[slug]/published-document.css";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Eye, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { HighlightedCode } from "~/app/[username]/[slug]/blocks/highlight-types";
import { highlightPreviewCode } from "~/app/[username]/[slug]/blocks/highlight-preview";
import { PublishedArticleBody } from "~/app/[username]/[slug]/blocks/published-blocks";
import {
  parsePublishedBlocks,
  publishedBlocksIncludeCode,
} from "~/app/[username]/[slug]/blocks/parse";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/app/_components/dialog";
import { DrawerTitle } from "~/app/_components/drawer";
import { MobileMenuDrawer } from "~/app/_components/mobile-drawer";
import { useDocumentPreviewStore } from "~/app/_components/editor/document-preview-store";
import type { DocumentPreviewSnapshot } from "~/app/_components/editor/document-preview-store";
import { useDocumentPublishStore } from "~/app/_components/editor/document-publish-store";
import { PublishedDocumentView } from "~/app/_components/published-document-view";
import { useDocumentPublish } from "~/hooks/use-document-publish";
import { useIsMobile } from "~/hooks/use-mobile";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";
import { useToast } from "~/hooks/use-toast";
import { useUserProfile } from "~/hooks/use-user-profile";
import { publicationOwnerPathSegment } from "~/lib/slug";
import { cn } from "~/lib/utils";

/** Snapshot the open editor and show the published-page preview. */
export function useOpenDocumentPreview() {
  const ctx = useDocumentPublish();
  const { data: profile } = useUserProfile();
  const { toast } = useToast();
  const open = useDocumentPreviewStore((state) => state.open);
  const openPreview = useDocumentPreviewStore((state) => state.openPreview);
  const closePreview = useDocumentPreviewStore((state) => state.closePreview);

  const toggle = () => {
    if (!ctx) return;

    if (open) {
      closePreview();
      return;
    }

    if (!ctx.editor) {
      toast({
        title: "Editor not ready",
        description: "Wait for the document to finish loading.",
      });
      return;
    }

    let blocks: unknown;
    try {
      blocks = JSON.parse(JSON.stringify(ctx.editor.document)) as unknown;
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't open preview",
        description: "The document couldn't be read.",
      });
      return;
    }

    const ownerFromProfile = profile
      ? publicationOwnerPathSegment({
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
        })
      : "";

    useDocumentPublishStore.getState().closeBothPanels();
    openPreview({
      title: ctx.title,
      blocks,
      publishedAt: ctx.publication?.published_at ?? new Date().toISOString(),
      ownerUsername: ctx.ownerPreview ?? ownerFromProfile,
      slug: ctx.publicSlugSegment,
      authorProfile: profile
        ? {
            username: profile.username,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            default_avatar_background_color:
              profile.default_avatar_background_color,
          }
        : null,
    });
  };

  return { open, toggle, available: ctx != null };
}

export function DocumentPreviewButton() {
  const { open, toggle, available } = useOpenDocumentPreview();

  if (!available) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={toggle}
      className={cn(
        "h-8 shrink-0 gap-1 rounded-md px-2 py-1 text-sm font-medium shadow-none",
        "whitespace-nowrap",
        "opacity-100 transition-[color,background-color,opacity] duration-200 ease-out",
        "hover:bg-accent hover:text-accent-foreground",
        "[&_svg]:size-3.5",
        open && "bg-accent text-accent-foreground",
      )}
    >
      <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
        <Eye aria-hidden />
      </span>
      <span className="whitespace-nowrap">Preview</span>
    </Button>
  );
}

function PreviewSurface({
  snapshot,
  variant,
}: {
  snapshot: DocumentPreviewSnapshot;
  variant: "sheet" | "drawer";
}) {
  const blocks = useMemo(
    () => parsePublishedBlocks(snapshot.blocks),
    [snapshot.blocks],
  );
  const [code, setCode] = useState<Map<string, HighlightedCode>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!publishedBlocksIncludeCode(blocks)) return;
    let cancelled = false;
    void highlightPreviewCode(blocks)
      .then((result) => {
        if (!cancelled) setCode(result);
      })
      .catch(() => {
        // Plain code still matches the published structure.
      });
    return () => {
      cancelled = true;
    };
  }, [blocks]);

  return (
    <>
      {variant === "sheet" ? (
        <>
          <DialogTitle className="sr-only">Preview</DialogTitle>
          <DialogClose asChild>
            <Button
              id="document-preview-close"
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 h-8 w-8 bg-background/90 hover:bg-accent"
            >
              <X aria-hidden />
              <span className="sr-only">Close preview</span>
            </Button>
          </DialogClose>
        </>
      ) : (
        <DrawerTitle className="sr-only">Preview</DrawerTitle>
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          variant === "drawer" && "pt-3",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PublishedDocumentView
            className="min-h-full"
            headerClassName={variant === "sheet" ? "pr-14" : undefined}
            title={snapshot.title}
            authorProfile={snapshot.authorProfile}
            ownerUsername={snapshot.ownerUsername}
            slug={snapshot.slug}
            publishedAt={snapshot.publishedAt}
          >
            <PublishedArticleBody blocks={blocks} code={code} />
          </PublishedDocumentView>
        </div>
      </div>
    </>
  );
}

export function DocumentPreviewSheet() {
  const open = useDocumentPreviewStore((state) => state.open);
  const snapshot = useDocumentPreviewStore((state) => state.snapshot);
  const generation = useDocumentPreviewStore((state) => state.generation);
  const closePreview = useDocumentPreviewStore((state) => state.closePreview);
  const isMobile = useIsMobile();
  const documentId = useRouteDocumentId();
  const previousDocumentId = useRef(documentId);

  useEffect(() => {
    if (previousDocumentId.current === documentId) return;
    previousDocumentId.current = documentId;
    closePreview();
  }, [closePreview, documentId]);

  const onOpenChange = (next: boolean) => {
    if (!next) closePreview();
  };

  if (isMobile) {
    return (
      <MobileMenuDrawer
        open={open}
        onOpenChange={onOpenChange}
        className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] bg-background"
      >
        {snapshot ? (
          <PreviewSurface
            key={generation}
            snapshot={snapshot}
            variant="drawer"
          />
        ) : null}
      </MobileMenuDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        {snapshot ? (
          <DialogPrimitive.Content
            key={generation}
            className={cn(
              "fixed inset-x-3 bottom-0 top-3 z-[60] flex min-h-0 flex-col overflow-hidden bg-background shadow-lg outline-none",
              "dark:border dark:border-sidebar-border",
              "rounded-t-xl md:inset-x-4 md:top-4",
              "ease-[cubic-bezier(0.22,1,0.36,1)] duration-500",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            )}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("document-preview-close")?.focus();
            }}
          >
            <PreviewSurface snapshot={snapshot} variant="sheet" />
          </DialogPrimitive.Content>
        ) : null}
      </DialogPortal>
    </Dialog>
  );
}
