"use client";

/**
 * Publish flow: `useDocumentPublish()` wires `document-publish-store` (Zustand) to tRPC,
 * the BlockNote editor, and toast — plus desktop/mobile panel components.
 * There is no React context; consumers import the hook and panels from this module.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- tRPC React Query hooks */

import { Check, Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { useToast } from "~/hooks/use-toast";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { slugifyTitle } from "~/lib/slug";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

import { useDocumentEditorStore } from "~/app/_components/editor/document-editor-store";
import type { AppBlockNoteEditor } from "~/app/_components/editor/editor-types";
import {
  useDocumentPublishStore,
  type PublishFeedbackState,
} from "~/app/_components/editor/document-publish-store";

type PublishDocumentResult = RouterOutputs["document"]["publishDocument"];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LIVE_HOST_DISPLAY = "chptr.io";
const MAX_USERNAME_DISPLAY_CHARS = 10;

function formatUsernameSegmentForDisplay(username: string): string {
  return username.length <= MAX_USERNAME_DISPLAY_CHARS ? username : "...";
}

async function blockNoteEditorToExportHtml(
  editor: AppBlockNoteEditor,
): Promise<string> {
  return editor.blocksToFullHTML(editor.document);
}

export type DocumentPublishValue = {
  documentId: string;
  editor: AppBlockNoteEditor | null;
  popoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  onAuxiliaryOpenChange: (open: boolean) => void;
  publishButtonLabel: string;
  publishButtonIcon: ReactNode;
  hasChangesToPublish: boolean;
  busy: boolean;
  publicationLoading: boolean;
  publication: NonNullable<
    RouterOutputs["document"]["getPublicationByDocumentId"]
  > | null;
  publishFeedback: PublishFeedbackState;
  handlePublish: () => Promise<void>;
  /** Published-article chrome (slug row, etc.) — hidden during first-publish freeze. */
  showPublishedPopoverActions: boolean;
  hasUnpublishedChanges: boolean;
  ownerPreview: string | null;
  copyPublicUrl: () => Promise<void>;
  buildUrlSlugCluster: (
    surface: "popover" | "mobile",
    options?: {
      inputId?: string;
      value?: string;
      onChange?: (value: string) => void;
      inputRef?: Ref<HTMLInputElement>;
    },
  ) => ReactNode;
  unpublish: () => void;
  unpublishPending: boolean;
  /** Effective path segment for the public URL (slug override or publication). */
  publicSlugSegment: string;
  /** Slug field differs from last published / default — counts toward publish. */
  hasPendingSlugChange: boolean;
  revertSlug: () => void;
};

export function useDocumentPublish(): DocumentPublishValue | null {
  const params = useParams();
  const documentId = params.documentId as string | undefined;
  const editor = useDocumentEditorStore((s) => s.editor);
  const { isNew } = useNewDocumentFlag();
  const { toast } = useToast();

  const popoverOpen = useDocumentPublishStore((s) => s.popoverOpen);
  const setPopoverOpen = useDocumentPublishStore((s) => s.setPopoverOpen);
  const mobileDrawerOpen = useDocumentPublishStore((s) => s.mobileDrawerOpen);
  const setMobileDrawerOpen = useDocumentPublishStore(
    (s) => s.setMobileDrawerOpen,
  );
  const slugOverride = useDocumentPublishStore((s) => s.slugOverride);
  const setSlugOverride = useDocumentPublishStore((s) => s.setSlugOverride);
  const publishFeedback = useDocumentPublishStore((s) => s.publishFeedback);
  const setPublishFeedback = useDocumentPublishStore(
    (s) => s.setPublishFeedback,
  );
  const freezeFirstPublishActions = useDocumentPublishStore(
    (s) => s.freezeFirstPublishActions,
  );
  const setFreezeFirstPublishActions = useDocumentPublishStore(
    (s) => s.setFreezeFirstPublishActions,
  );
  const revertSlugStore = useDocumentPublishStore((s) => s.revertSlug);
  const onAuxiliaryOpenStore = useDocumentPublishStore(
    (s) => s.onAuxiliaryOpen,
  );
  const closeBothPanels = useDocumentPublishStore((s) => s.closeBothPanels);
  const resetForNavigation = useDocumentPublishStore(
    (s) => s.resetForNavigation,
  );

  const closePopoverTimeoutRef = useRef<number | null>(null);

  /** Only reset store when the route document changes — not when extra consumers mount (popover panel, drawer panel). */
  const prevDocumentIdForResetRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevDocumentIdForResetRef.current;
    prevDocumentIdForResetRef.current = documentId;
    if (prev !== undefined && prev !== documentId) {
      resetForNavigation();
    }
  }, [documentId, resetForNavigation]);

  const enabled = !!documentId && !isNew;

  const { data: docMeta } = api.document.getDocumentById.useQuery(
    documentId ?? "",
    { enabled },
  );

  const { data: publication, isLoading: publicationLoading } =
    api.document.getPublicationByDocumentId.useQuery(documentId ?? "", {
      enabled,
    });

  const { data: ownerPathData } =
    api.document.getPublicationOwnerPathSegment.useQuery(documentId ?? "", {
      enabled: enabled && !publication,
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
      closeBothPanels();
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

  const previewSlugSegment = slugOverride.trim()
    ? slugifyTitle(slugOverride)
    : publication
      ? publication.slug
      : slugifyTitle(title);

  const publishedSlugBaseline = publication
    ? publication.slug
    : slugifyTitle(title);

  const hasPendingSlugChange = previewSlugSegment !== publishedSlugBaseline;

  const docLastUpdated = docMeta?.document?.last_updated;
  const hasUnpublishedChanges =
    !!publication &&
    !!docLastUpdated &&
    new Date(docLastUpdated).getTime() >
      new Date(publication.updated_at).getTime();

  const hasChangesToPublish =
    !publicationLoading &&
    (publication === null || hasUnpublishedChanges || hasPendingSlugChange);
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

  const publishButtonIcon = useMemo(() => {
    if (publishFeedback === "publishing") {
      return (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      );
    }
    if (publishFeedback === "published") {
      return (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
      );
    }
    return null;
  }, [publishFeedback]);

  const showPublishedPopoverActions =
    !!publication && !freezeFirstPublishActions;

  const onAuxiliaryOpenChange = useCallback(
    (open: boolean) => {
      if (open) onAuxiliaryOpenStore();
    },
    [onAuxiliaryOpenStore],
  );

  const anyPublishPanelOpen = popoverOpen || mobileDrawerOpen;
  const prevAnyPublishPanelOpen = useRef(false);
  useEffect(() => {
    if (prevAnyPublishPanelOpen.current && !anyPublishPanelOpen) {
      setSlugOverride("");
    }
    prevAnyPublishPanelOpen.current = anyPublishPanelOpen;
  }, [anyPublishPanelOpen, setSlugOverride]);

  useEffect(() => {
    return () => {
      if (closePopoverTimeoutRef.current != null) {
        window.clearTimeout(closePopoverTimeoutRef.current);
      }
    };
  }, []);

  const handlePublish = useCallback(async () => {
    if (!editor || !documentId) {
      toast({
        variant: "destructive",
        title: "Editor not ready",
        description: "Wait for the document to finish loading.",
      });
      return;
    }

    if (closePopoverTimeoutRef.current != null) {
      window.clearTimeout(closePopoverTimeoutRef.current);
      closePopoverTimeoutRef.current = null;
    }

    const isFirstTimePublish = publication === null;
    if (isFirstTimePublish) {
      setFreezeFirstPublishActions(true);
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

      closePopoverTimeoutRef.current = window.setTimeout(() => {
        closeBothPanels();
      }, 800);
    } catch {
      setPublishFeedback("failed");
      setFreezeFirstPublishActions(false);

      window.setTimeout(() => {
        setPublishFeedback("idle");
      }, 1400);
    }
  }, [
    documentId,
    editor,
    publication,
    publishMutation,
    slugOverride,
    title,
    toast,
    closeBothPanels,
    setFreezeFirstPublishActions,
    setPublishFeedback,
  ]);

  const copyPublicUrl = useCallback(async () => {
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
  }, [ownerPreview, previewSlugSegment, toast]);

  const buildUrlSlugCluster = useCallback(
    (
      surface: "popover" | "mobile",
      options?: {
        inputId?: string;
        value?: string;
        onChange?: (value: string) => void;
        inputRef?: Ref<HTMLInputElement>;
      },
    ) => {
      const isDrawerMobileSurface = surface === "mobile";
      const isControlled = options?.value !== undefined && !!options.onChange;
      const inputValue = isControlled ? options.value : slugOverride;
      const inputId =
        options?.inputId ??
        (isDrawerMobileSurface ? "publish-slug-mobile" : "publish-slug");
      const showInlineRevert =
        !isControlled && hasPendingSlugChange && surface !== "mobile";

      const cluster = (
        <>
          <div
            className={cn(
              "flex w-full min-w-0 items-stretch overflow-hidden",
              isDrawerMobileSurface
                ? cn(
                    "min-h-10 rounded-lg border border-sidebar-border/70 bg-background/50 shadow-inner",
                    "dark:border-white/[0.12] dark:bg-black/35",
                    "focus-within:ring-1 focus-within:ring-ring",
                  )
                : cn(
                    "min-h-9 rounded-md border border-input shadow-sm",
                    "bg-transparent dark:border-sidebar-border dark:bg-background",
                    "dark:shadow-[inset_0_1px_0_0_hsl(0_0%_100%_/_0.06)]",
                    "focus-within:ring-1 focus-within:ring-ring",
                  ),
            )}
          >
            <span
              className={cn(
                "inline-flex shrink-0 items-center border-r px-2 py-1.5 text-xs sm:text-sm",
                isDrawerMobileSurface
                  ? "border-sidebar-border/60 bg-muted/30 text-muted-foreground dark:border-white/[0.1] dark:bg-white/[0.06]"
                  : "border-input bg-muted/40 text-muted-foreground dark:border-sidebar-border dark:bg-sidebar-accent dark:text-sidebar-foreground/70",
              )}
              title={urlPrefixTitle}
              aria-hidden
            >
              {urlPrefixDisplay}
            </span>
            <Input
              ref={options?.inputRef}
              id={inputId}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              className={cn(
                "min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sidebar-foreground shadow-none focus-visible:ring-0",
                isDrawerMobileSurface ? "h-10 text-base" : "h-9",
                showInlineRevert ? "rounded-none" : "rounded-r-md",
              )}
              placeholder={slugPlaceholder}
              value={inputValue}
              onChange={(e) => {
                const next = e.target.value.replace(/\s+/g, "-");
                if (isControlled) {
                  options.onChange?.(next);
                } else {
                  setSlugOverride(next);
                }
              }}
              disabled={busy}
            />
            {showInlineRevert ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                title="Revert URL slug"
                className="h-9 w-9 shrink-0 rounded-none rounded-r-md border-l border-input text-muted-foreground transition-colors hover:text-foreground dark:border-sidebar-border"
                onClick={revertSlugStore}
              >
                <Undo2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">Revert URL slug</span>
              </Button>
            ) : null}
          </div>
          {!ownerPreview && surface === "popover" ? (
            <p className="text-xs text-muted-foreground">
              Add a username in Account to use your real URL path.
            </p>
          ) : null}
        </>
      );

      return cluster;
    },
    [
      busy,
      hasPendingSlugChange,
      ownerPreview,
      revertSlugStore,
      setSlugOverride,
      slugOverride,
      slugPlaceholder,
      urlPrefixDisplay,
      urlPrefixTitle,
    ],
  );

  const unpublish = useCallback(() => {
    if (documentId) unpublishMutation.mutate(documentId);
  }, [documentId, unpublishMutation]);

  return useMemo((): DocumentPublishValue | null => {
    if (!documentId || isNew) return null;

    return {
      documentId,
      editor,
      popoverOpen,
      setPopoverOpen,
      mobileDrawerOpen,
      setMobileDrawerOpen,
      onAuxiliaryOpenChange,
      publishButtonLabel,
      publishButtonIcon,
      hasChangesToPublish,
      busy,
      publicationLoading,
      publication: publication ?? null,
      publishFeedback,
      handlePublish,
      showPublishedPopoverActions,
      hasUnpublishedChanges,
      ownerPreview,
      copyPublicUrl,
      buildUrlSlugCluster,
      unpublish,
      unpublishPending: unpublishMutation.isPending,
      publicSlugSegment: previewSlugSegment,
      hasPendingSlugChange,
      revertSlug: revertSlugStore,
    };
  }, [
    buildUrlSlugCluster,
    busy,
    copyPublicUrl,
    documentId,
    editor,
    handlePublish,
    hasChangesToPublish,
    hasPendingSlugChange,
    hasUnpublishedChanges,
    isNew,
    ownerPreview,
    mobileDrawerOpen,
    onAuxiliaryOpenChange,
    popoverOpen,
    publication,
    publicationLoading,
    publishButtonIcon,
    publishButtonLabel,
    publishFeedback,
    revertSlugStore,
    showPublishedPopoverActions,
    unpublish,
    unpublishMutation.isPending,
    previewSlugSegment,
    setMobileDrawerOpen,
    setPopoverOpen,
  ]);
}
