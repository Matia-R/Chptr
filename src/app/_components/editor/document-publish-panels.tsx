"use client";

import {
  Check,
  ChevronLeft,
  CloudUpload,
  ExternalLink,
  Globe,
  GlobeOff,
  Link as LinkIcon,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "~/app/_components/button";
import { cn } from "~/lib/utils";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";

import {
  MobileActionButtonRow,
  MobileActionGroup,
  MobileActionLinkRow,
} from "~/app/_components/mobile-action-rows";
import {
  useDocumentPublish,
  type DocumentPublishValue,
} from "~/hooks/use-document-publish";
import {
  useDocumentPublishStore,
  type MobileDrawerView,
} from "~/app/_components/editor/document-publish-store";

const drawerViewTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const STAGE_HEIGHT_TRANSITION_CLASS =
  "transition-[min-height] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

/** Minimum stage height for the edit-url layout (header + field + helper copy). */
const EDIT_URL_MIN_CONTENT_PX = 268;
/** Extra stage height so the field clears the keyboard accessory bar. */
const EDIT_URL_STAGE_CLEARANCE_PX = 72;
/** Additional drawer shell height above the visual viewport when the keyboard is open. */
const EDIT_URL_KEYBOARD_DRAWER_EXTRA_PX = 56;

const drawerViewVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
  }),
};

/** Nudge the Vaul drawer taller when the keyboard is open on the edit-url view. */
function applyEditUrlKeyboardDrawerInset() {
  const drawer = document.querySelector("[data-vaul-drawer]");
  const viewport = window.visualViewport;
  if (!(drawer instanceof HTMLElement) || !viewport) return;

  const keyboardOpen = viewport.height < window.innerHeight * 0.85;
  if (!keyboardOpen) return;

  const targetHeight = viewport.height + EDIT_URL_KEYBOARD_DRAWER_EXTRA_PX;
  if (drawer.getBoundingClientRect().height < targetHeight - 1) {
    drawer.style.height = `${targetHeight}px`;
  }
}

/** Clear Vaul inline styles applied while the keyboard was open. */
function resetVaulDrawerKeyboardStyles() {
  const drawer = document.querySelector("[data-vaul-drawer]");
  if (!(drawer instanceof HTMLElement)) return;
  drawer.style.removeProperty("bottom");
  drawer.style.removeProperty("height");
  drawer.style.removeProperty("top");
}

/** Run after the software keyboard has dismissed (iOS visual viewport). */
function waitForKeyboardDismiss(callback: () => void) {
  const viewport = window.visualViewport;
  const fallbackMs = 400;

  const finish = () => {
    callback();
  };

  if (!viewport) {
    window.setTimeout(finish, fallbackMs);
    return;
  }

  const keyboardLikelyOpen = () =>
    viewport.height < window.innerHeight * 0.85;

  if (!keyboardLikelyOpen()) {
    finish();
    return;
  }

  let done = false;
  const complete = () => {
    if (done) return;
    done = true;
    viewport.removeEventListener("resize", onResize);
    finish();
  };

  const onResize = () => {
    if (!keyboardLikelyOpen()) {
      complete();
    }
  };

  viewport.addEventListener("resize", onResize);
  window.setTimeout(complete, fallbackMs);
}

function formatPublicationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function focusMobileSlugInput(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  } catch {
    input.focus();
  }
}

function MobilePublishEditUrlView({
  buildUrlSlugCluster,
  ownerPreview,
  busy,
  onBack,
  onDone,
}: {
  buildUrlSlugCluster: DocumentPublishValue["buildUrlSlugCluster"];
  ownerPreview: string | null;
  busy: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const slugOverride = useDocumentPublishStore((s) => s.slugOverride);
  const setSlugOverride = useDocumentPublishStore((s) => s.setSlugOverride);
  const [draftSlug, setDraftSlug] = useState(slugOverride);
  const snapshotRef = useRef(slugOverride);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    snapshotRef.current = slugOverride;
    setDraftSlug(slugOverride);
    // Snapshot draft only when this view mounts (AnimatePresence unmounts on exit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaveEditUrl = (commit: boolean) => {
    inputRef.current?.blur();
    if (commit) {
      setSlugOverride(draftSlug);
    } else {
      setSlugOverride(snapshotRef.current);
    }

    waitForKeyboardDismiss(() => {
      resetVaulDrawerKeyboardStyles();
      if (commit) {
        onDone();
      } else {
        onBack();
      }
    });
  };

  const handleBack = () => leaveEditUrl(false);
  const handleDone = () => leaveEditUrl(true);

  return (
    <>
      <header className="flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-sidebar-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-h-[44px] shrink-0 gap-1 px-2 text-[17px] font-normal text-muted-foreground"
          disabled={busy}
          onClick={handleBack}
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          Back
        </Button>
        <h2 className="min-w-0 flex-1 text-center text-lg font-semibold leading-none tracking-tight">
          Edit URL
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-h-[44px] shrink-0 px-3 text-[17px] font-semibold"
          disabled={busy}
          onClick={handleDone}
        >
          Done
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-8 pt-6">
        <div className="grid min-w-0 gap-2">
          {buildUrlSlugCluster("mobile", {
            value: draftSlug,
            onChange: setDraftSlug,
            inputRef,
          })}
        </div>
        {!ownerPreview ? (
          <p className="text-xs text-muted-foreground">
            Add a username in Account to use your real URL path.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          URL changes apply after you publish.
        </p>
      </div>
    </>
  );
}

function MobilePublishMainView({
  onEditUrl,
  statusRow,
}: {
  onEditUrl: () => void;
  statusRow: ReactNode;
}) {
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
    ownerPreview,
    copyPublicUrl,
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

  const header = (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-sidebar-foreground">Publish</DrawerTitle>
        <DrawerDescription className="sr-only">
          Publish and manage this article
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4 pb-4 text-sm text-muted-foreground">{statusRow}</div>
    </>
  );

  if (showPublishedPopoverActions && pub) {
    return (
      <div className="w-full">
        {header}
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
          <MobileActionButtonRow
            icon={Globe}
            label="Edit URL"
            disabled={busy}
            onClick={onEditUrl}
          />
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
            icon={GlobeOff as LucideIcon}
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
      </div>
    );
  }

  return (
    <div className="w-full">
      {header}
      <div className="flex flex-col gap-3 px-4 pb-8 pt-1">
        <MobileActionGroup>
          <MobileActionButtonRow
            icon={Globe}
            label="Edit URL"
            disabled={busy}
            onClick={onEditUrl}
          />
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
    </div>
  );
}

/** Mobile publish drawer with animated main / edit-url views. */
export function DocumentPublishMobileDrawer({
  statusRow,
}: {
  statusRow: ReactNode;
}) {
  const ctx = useDocumentPublish();
  const view = useDocumentPublishStore((s) => s.mobileDrawerView);
  const setView = useDocumentPublishStore((s) => s.setMobileDrawerView);
  const [direction, setDirection] = useState(1);
  const [stageMinHeight, setStageMinHeight] = useState<number>();
  const [mainStageHeight, setMainStageHeight] = useState<number>();
  const stageRef = useRef<HTMLDivElement>(null);
  const mainMeasureRef = useRef<HTMLDivElement>(null);
  const editMeasureRef = useRef<HTMLDivElement>(null);

  const goToView = useCallback((next: MobileDrawerView, nextDirection: number) => {
    setDirection(nextDirection);
    setView(next);
  }, [setView]);

  const measureMainStage = useCallback(() => {
    const node = mainMeasureRef.current ?? stageRef.current;
    if (!node) return;
    const height = node.getBoundingClientRect().height;
    if (height > 0) {
      setMainStageHeight(height);
      if (useDocumentPublishStore.getState().mobileDrawerView === "main") {
        setStageMinHeight(height);
      }
    }
  }, []);

  const expandStageForEditUrl = useCallback(() => {
    const mainH =
      mainStageHeight ??
      mainMeasureRef.current?.getBoundingClientRect().height ??
      0;
    const target =
      Math.max(mainH, EDIT_URL_MIN_CONTENT_PX) + EDIT_URL_STAGE_CLEARANCE_PX;
    setStageMinHeight(target);
  }, [mainStageHeight]);

  const returnToMain = useCallback(() => {
    if (mainStageHeight != null) {
      setStageMinHeight(mainStageHeight);
    }
    goToView("main", -1);
  }, [goToView, mainStageHeight]);

  const showPublishedPopoverActions = ctx?.showPublishedPopoverActions;
  const publicationSlug = ctx?.publication?.slug;
  const ownerPreview = ctx?.ownerPreview;

  useLayoutEffect(() => {
    if (!ctx || view !== "main") return;
    resetVaulDrawerKeyboardStyles();
    measureMainStage();
  }, [
    view,
    statusRow,
    measureMainStage,
    ctx,
    showPublishedPopoverActions,
    publicationSlug,
    ownerPreview,
  ]);

  useLayoutEffect(() => {
    if (view !== "edit-url" || !editMeasureRef.current) return;
    const editH = editMeasureRef.current.getBoundingClientRect().height;
    if (editH <= 0) return;
    const target =
      Math.max(mainStageHeight ?? 0, editH) + EDIT_URL_STAGE_CLEARANCE_PX;
    setStageMinHeight((prev) => Math.max(prev ?? 0, target));
  }, [view, mainStageHeight, ownerPreview]);

  useEffect(() => {
    if (view !== "edit-url") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const onViewportChange = () => {
      applyEditUrlKeyboardDrawerInset();
    };

    viewport.addEventListener("resize", onViewportChange);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(onViewportChange);
    });

    return () => {
      viewport.removeEventListener("resize", onViewportChange);
      cancelAnimationFrame(frame);
    };
  }, [view]);

  if (!ctx) return null;

  const stageIsMeasured = stageMinHeight !== undefined;

  return (
    <div className="bg-sidebar text-sidebar-foreground">
      <div
        ref={stageRef}
        className={cn(
          "relative w-full overflow-hidden",
          stageIsMeasured && STAGE_HEIGHT_TRANSITION_CLASS,
        )}
        style={stageIsMeasured ? { minHeight: stageMinHeight } : undefined}
      >
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={view}
            ref={view === "main" ? mainMeasureRef : editMeasureRef}
            custom={direction}
            variants={drawerViewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={drawerViewTransition}
            className={cn(
              "w-full bg-sidebar",
              stageIsMeasured && "absolute inset-x-0 top-0",
            )}
            onAnimationComplete={(definition) => {
              if (definition === "center" && view === "edit-url") {
                const input = document.getElementById(
                  "publish-slug-mobile",
                ) as HTMLInputElement | null;
                focusMobileSlugInput(input);
                window.setTimeout(() => {
                  applyEditUrlKeyboardDrawerInset();
                }, 50);
              }
            }}
          >
            {view === "edit-url" ? (
              <MobilePublishEditUrlView
                buildUrlSlugCluster={ctx.buildUrlSlugCluster}
                ownerPreview={ctx.ownerPreview}
                busy={ctx.busy}
                onBack={returnToMain}
                onDone={returnToMain}
              />
            ) : (
              <MobilePublishMainView
                statusRow={statusRow}
                onEditUrl={() => {
                  measureMainStage();
                  expandStageForEditUrl();
                  goToView("edit-url", 1);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
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
          <div className="grid min-w-0 gap-2">{buildUrlSlugCluster("popover")}</div>
        </section>
      ) : (
        <div className="grid min-w-0 gap-2">{buildUrlSlugCluster("popover")}</div>
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
