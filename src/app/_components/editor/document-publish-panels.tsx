"use client";

import {
  Check,
  CloudUpload,
  ExternalLink,
  X,
  Globe,
  GlobeOff,
  Link as LinkIcon,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "~/app/_components/button";
import { cn } from "~/lib/utils";
import {
  MobileDrawerEditBody,
  MobileDrawerNavHeader,
  MobileDrawerScreenHeader,
  MobileDrawerViewStack,
  resetMobileDrawerKeyboardStyles,
  useMobileDrawerStage,
  waitForMobileDrawerKeyboardDismiss,
} from "~/app/_components/mobile-drawer";

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
  type PublishFeedbackState,
} from "~/app/_components/editor/document-publish-store";

function getMobilePublishActionRow(
  publishFeedback: PublishFeedbackState,
  options: {
    showPublishedPopoverActions: boolean;
    hasChangesToPublish: boolean;
    firstPublishLabel?: string;
  },
) {
  const label =
    publishFeedback === "publishing"
      ? "Publishing..."
      : publishFeedback === "published"
        ? "Published"
        : publishFeedback === "failed"
          ? "Failed to publish"
          : options.showPublishedPopoverActions
            ? options.hasChangesToPublish
              ? "Publish changes"
              : "Up to date"
            : (options.firstPublishLabel ?? "Publish");

  const icon: LucideIcon =
    publishFeedback === "publishing"
      ? Loader2
      : publishFeedback === "published"
        ? Check
        : publishFeedback === "failed"
          ? X
          : CloudUpload;

  const iconClassName =
    publishFeedback === "publishing"
      ? "animate-spin"
      : publishFeedback === "published"
        ? "text-emerald-600"
        : publishFeedback === "failed"
          ? "text-destructive"
          : undefined;

  const disabledWhenIdle =
    !options.hasChangesToPublish && publishFeedback === "idle";

  return { label, icon, iconClassName, disabledWhenIdle };
}

function formatPublicationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
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

    waitForMobileDrawerKeyboardDismiss(() => {
      resetMobileDrawerKeyboardStyles();
      if (commit) {
        onDone();
      } else {
        onBack();
      }
    });
  };

  return (
    <>
      <MobileDrawerNavHeader
        title="Edit URL"
        disabled={busy}
        onBack={() => leaveEditUrl(false)}
        onDone={() => leaveEditUrl(true)}
      />
      <MobileDrawerEditBody helperText="URL changes apply after you publish.">
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
      </MobileDrawerEditBody>
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

  const publishAction = getMobilePublishActionRow(publishFeedback, {
    showPublishedPopoverActions,
    hasChangesToPublish,
  });
  const pub = publication;

  const header = (
    <MobileDrawerScreenHeader
      title="Publish"
      description="Publish and manage this article"
      subtitle={statusRow}
    />
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
              icon={publishAction.icon}
              iconClassName={publishAction.iconClassName}
              label={publishAction.label}
              disabled={
                busy ||
                !editor ||
                publicationLoading ||
                publishAction.disabledWhenIdle
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
            icon={publishAction.icon}
            iconClassName={publishAction.iconClassName}
            label={publishAction.label}
            disabled={busy || !editor || publishAction.disabledWhenIdle}
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

  const showPublishedPopoverActions = ctx?.showPublishedPopoverActions;
  const publicationSlug = ctx?.publication?.slug;
  const ownerPreview = ctx?.ownerPreview;

  const stage = useMobileDrawerStage<MobileDrawerView>({
    view,
    setView,
    mainView: "main",
    keyboardView: "edit-url",
    measureDeps: [
      statusRow,
      showPublishedPopoverActions,
      publicationSlug,
      ownerPreview,
    ],
  });

  if (!ctx) return null;

  return (
    <MobileDrawerViewStack
      view={view}
      direction={stage.direction}
      stageMinHeight={stage.stageMinHeight}
      stageIsMeasured={stage.stageIsMeasured}
      stageRef={stage.stageRef}
      getMotionRef={stage.getMotionRef}
      focusInputIdOnEnter={{ "edit-url": "publish-slug-mobile" }}
      renderView={(currentView) =>
        currentView === "edit-url" ? (
          <MobilePublishEditUrlView
            buildUrlSlugCluster={ctx.buildUrlSlugCluster}
            ownerPreview={ctx.ownerPreview}
            busy={ctx.busy}
            onBack={stage.returnToMainView}
            onDone={stage.returnToMainView}
          />
        ) : (
          <MobilePublishMainView
            statusRow={statusRow}
            onEditUrl={() => {
              stage.measureMainStage();
              stage.expandStageForKeyboardView();
              stage.goToView("edit-url", 1);
            }}
          />
        )
      }
    />
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
          <div className="grid min-w-0 gap-2">
            {buildUrlSlugCluster("popover")}
          </div>
        </section>
      ) : (
        <div className="grid min-w-0 gap-2">
          {buildUrlSlugCluster("popover")}
        </div>
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
