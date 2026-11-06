"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CloudUpload,
  ExternalLink,
  BookOpen,
  Check,
  Pencil,
  X,
  Globe,
  GlobeOff,
  Link as LinkIcon,
  Loader2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "~/app/_components/button";
import {
  publishFeedbackToSaveState,
  SaveFeedbackContent,
  SaveFeedbackLabel,
  SAVE_FEEDBACK_CONTENT_TRANSITION,
} from "~/app/_components/save-feedback-label";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { PUBLIC_SITE_HOST } from "~/lib/public-url";
import { slugifyTitle } from "~/lib/slug";
import { cn } from "~/lib/utils";
import {
  MobileDrawerFieldView,
  MobileDrawerScreenHeader,
  MobileDrawerViewStack,
  useMobileDrawerStage,
} from "~/app/_components/mobile-drawer";

import {
  MobileActionButtonRow,
  MobileActionFeedbackRow,
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
import { useOpenDocumentPreview } from "~/app/_components/document-preview";
import { useCopyDocumentLink } from "~/hooks/use-copy-document-link";
import { useTrashDocument } from "~/hooks/use-trash-document";

/** Same fade as save feedback, a quarter faster. */
const URL_EDIT_TRANSITION = {
  duration: SAVE_FEEDBACK_CONTENT_TRANSITION.duration * 0.75,
  ease: SAVE_FEEDBACK_CONTENT_TRANSITION.ease,
};

/** True when the slug editor's enter animation has finished, not its exit. */
function isUrlEditEnterComplete(definition: unknown) {
  return (
    typeof definition === "object" &&
    definition !== null &&
    "opacity" in definition &&
    definition.opacity === 1
  );
}

function MobilePublishActionRow({
  extraDisabled = false,
}: {
  extraDisabled?: boolean;
}) {
  const ctx = useDocumentPublish();
  if (!ctx) return null;

  const {
    editor,
    busy,
    publishFeedback,
    handlePublish,
    hasChangesToPublish,
    showPublishedPopoverActions,
  } = ctx;

  return (
    <MobileActionFeedbackRow
      state={publishFeedbackToSaveState(publishFeedback)}
      idleIcon={CloudUpload}
      failedIcon={X}
      idleLabel={
        showPublishedPopoverActions
          ? hasChangesToPublish
            ? "Update"
            : "Published"
          : "Publish"
      }
      savingLabel="Publishing..."
      savedLabel="Published"
      failedLabel="Failed to publish"
      disabled={
        extraDisabled ||
        busy ||
        !editor ||
        (!hasChangesToPublish && publishFeedback === "idle")
      }
      onClick={() => {
        void handlePublish();
      }}
    />
  );
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
    if (commit) {
      setSlugOverride(draftSlug);
      onDone();
    } else {
      setSlugOverride(snapshotRef.current);
      onBack();
    }
  };

  return (
    <MobileDrawerFieldView
      title="Edit URL"
      helperText="URL changes apply after you publish."
      disabled={busy}
      onBack={() => leaveEditUrl(false)}
      onDone={() => leaveEditUrl(true)}
    >
      <div className="grid min-w-0 gap-2">
        {buildUrlSlugCluster("mobile", {
          value: draftSlug,
          onChange: setDraftSlug,
          inputRef,
        })}
      </div>
      {!ownerPreview ? (
        <p className="text-xs text-muted-foreground">
          Add a handle in Account to use your real URL path.
        </p>
      ) : null}
    </MobileDrawerFieldView>
  );
}

function MobilePublishMainView({
  onEditUrl,
  onMoveToTrash,
  moveToTrashDisabled,
  statusRow,
}: {
  onEditUrl: () => void;
  onMoveToTrash: () => void;
  moveToTrashDisabled: boolean;
  statusRow: ReactNode;
}) {
  const ctx = useDocumentPublish();
  const copyDocumentLink = useCopyDocumentLink();
  const { toggle: togglePreview } = useOpenDocumentPreview();
  if (!ctx) return null;

  const {
    documentId,
    busy,
    publicationLoading,
    publication,
    showPublishedPopoverActions,
    ownerPreview,
    copyPublicUrl,
    unpublish,
    unpublishPending,
    setMobileDrawerOpen,
  } = ctx;

  if (!documentId) return null;

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
            <MobileActionButtonRow
              icon={BookOpen}
              label="Preview"
              onClick={togglePreview}
            />
            <MobileActionLinkRow
              icon={ExternalLink}
              label="View page"
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
              Add a handle in Account to use your real URL path.
            </p>
          ) : null}

          <MobileActionGroup>
            <MobilePublishActionRow extraDisabled={publicationLoading} />
          </MobileActionGroup>

          <MobileActionGroup>
            <MobileActionButtonRow
              icon={GlobeOff as LucideIcon}
              label="Unpublish"
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
            <MobileActionButtonRow
              icon={Trash2}
              label="Move to trash"
              destructive
              disabled={moveToTrashDisabled}
              onClick={onMoveToTrash}
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
            icon={BookOpen}
            label="Preview"
            onClick={togglePreview}
          />
          <MobileActionButtonRow
            icon={LinkIcon}
            label="Copy link"
            disabled={!documentId}
            onClick={() => {
              void copyDocumentLink(documentId);
              setMobileDrawerOpen(false);
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
            Add a handle in Account to use your real URL path.
          </p>
        ) : null}
        <MobileActionGroup>
          <MobilePublishActionRow />
        </MobileActionGroup>
        <MobileActionGroup>
          <MobileActionButtonRow
            icon={Trash2}
            label="Move to trash"
            destructive
            disabled={moveToTrashDisabled}
            onClick={onMoveToTrash}
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
  const { trashCurrent, isPending, isOffline } = useTrashDocument();

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

  const moveToTrashDisabled = isOffline || isPending || ctx.busy;

  return (
    <MobileDrawerViewStack
      view={view}
      direction={stage.direction}
      stageMinHeight={stage.stageMinHeight}
      stageIsMeasured={stage.stageIsMeasured}
      stageRef={stage.stageRef}
      getMotionRef={stage.getMotionRef}
      renderView={(currentView) => {
        if (currentView === "edit-url") {
          return (
            <MobilePublishEditUrlView
              buildUrlSlugCluster={ctx.buildUrlSlugCluster}
              ownerPreview={ctx.ownerPreview}
              busy={ctx.busy}
              onBack={stage.returnToMainView}
              onDone={stage.returnToMainView}
            />
          );
        }
        return (
          <MobilePublishMainView
            statusRow={statusRow}
            onEditUrl={() => {
              stage.measureMainStage();
              stage.goToView("edit-url", 1);
            }}
            onMoveToTrash={() => {
              void trashCurrent();
            }}
            moveToTrashDisabled={moveToTrashDisabled}
          />
        );
      }}
    />
  );
}

/** Published popover: live URL, slug editor, and unpublish / update actions. */
function PublishedArticleSection({
  publication,
  buildUrlSlugCluster,
  savePublicationSlug,
  busy,
  publicationLoading,
  editor,
  publishFeedback,
  handlePublish,
  hasChangesToPublish,
  unpublish,
  unpublishPending,
}: {
  publication: NonNullable<DocumentPublishValue["publication"]>;
  buildUrlSlugCluster: DocumentPublishValue["buildUrlSlugCluster"];
  savePublicationSlug: DocumentPublishValue["savePublicationSlug"];
  busy: boolean;
  publicationLoading: boolean;
  editor: DocumentPublishValue["editor"];
  publishFeedback: DocumentPublishValue["publishFeedback"];
  handlePublish: DocumentPublishValue["handlePublish"];
  hasChangesToPublish: boolean;
  unpublish: DocumentPublishValue["unpublish"];
  unpublishPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(publication.slug);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedback = useSaveFeedback();
  const liveUrl = `${PUBLIC_SITE_HOST}/${publication.owner_username}/${publication.slug}`;

  /** Puts the caret at the end of the slug after the edit transition. */
  function focusSlugAtEnd() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  /** Opens the slug editor with the currently published slug. */
  function beginEdit() {
    setDraft(publication.slug);
    setEditing(true);
  }

  /** Closes the slug editor and restores the published slug. */
  function cancelEdit() {
    if (feedback.inFlight || feedback.state === "saved") return;
    setDraft(publication.slug);
    setEditing(false);
  }

  /** Saves a changed slug, or closes the editor when the slug is unchanged. */
  async function confirmEdit() {
    if (feedback.inFlight) return;
    const next = draft.trim();
    if (!next || slugifyTitle(next) === publication.slug) {
      setEditing(false);
      return;
    }
    feedback.start();
    const ok = await savePublicationSlug(next);
    await feedback.settle(ok ? "saved" : "failed");
    if (ok) {
      feedback.runAfterResult(() => setEditing(false), SAVE_FEEDBACK_SETTLE_MS);
    }
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-5"
      aria-label="Published article"
    >
      <div className="flex flex-col gap-3">
        <div className="grid min-w-0 gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
            Live at
          </p>
          <div className="relative min-w-0">
            <div
              className="invisible flex min-w-0 items-center gap-2"
              aria-hidden
            >
              <span className="min-w-0 flex-1 break-words text-[15px] leading-snug">
                {liveUrl}
                <ArrowUpRight
                  className="ml-0.5 inline size-3.5 align-[-2px]"
                  aria-hidden
                />
              </span>
              <span className="size-9 shrink-0" />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={URL_EDIT_TRANSITION}
                  onAnimationComplete={(definition) => {
                    if (!isUrlEditEnterComplete(definition)) return;
                    focusSlugAtEnd();
                  }}
                  className="absolute inset-0 flex items-center gap-1"
                >
                  <div className="min-w-0 flex-1">
                    {buildUrlSlugCluster("popover", {
                      value: draft,
                      onChange: setDraft,
                      inputRef,
                      ariaLabel: "Article URL",
                      disabled: feedback.inFlight || feedback.state === "saved",
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancel URL edit"
                    disabled={feedback.inFlight || feedback.state === "saved"}
                    onClick={cancelEdit}
                  >
                    <X aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="disabled:opacity-100"
                    aria-label={
                      feedback.state === "saving" ? "Saving URL" : "Save URL"
                    }
                    disabled={
                      busy ||
                      feedback.inFlight ||
                      feedback.state === "saved"
                    }
                    onClick={() => {
                      void confirmEdit();
                    }}
                  >
                    <SaveFeedbackContent motionKey={feedback.state}>
                      {feedback.state === "saving" ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : feedback.state === "failed" ? (
                        <X className="text-destructive" aria-hidden />
                      ) : (
                        <Check aria-hidden />
                      )}
                    </SaveFeedbackContent>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="live"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={URL_EDIT_TRANSITION}
                  className="absolute inset-0 flex items-center gap-2"
                >
                  <Link
                    href={`/${publication.owner_username}/${publication.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 break-words text-[15px] leading-snug text-foreground"
                  >
                    <span className="decoration-foreground/40 underline-offset-2 hover:underline">
                      {liveUrl}
                    </span>
                    <ArrowUpRight
                      className="ml-0.5 inline size-3.5 align-[-2px]"
                      aria-hidden
                    />
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit URL"
                    onClick={beginEdit}
                  >
                    <Pencil aria-hidden />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Last published {formatPublicationDate(publication.updated_at)}
        </p>
      </div>
      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || publicationLoading || feedback.inFlight}
          className="min-w-0 flex-1 !px-4 transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.98]"
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
            "min-w-0 flex-1 transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.98]",
            (busy || publishFeedback !== "idle") && "disabled:opacity-100",
          )}
          disabled={
            busy ||
            feedback.inFlight ||
            !editor ||
            publicationLoading ||
            (!hasChangesToPublish && publishFeedback === "idle")
          }
          onClick={() => {
            void handlePublish();
          }}
        >
          <SaveFeedbackLabel
            state={publishFeedbackToSaveState(publishFeedback)}
            idleLabel="Update"
            savingLabel="Publishing..."
            savedLabel="Published"
            failedLabel="Failed to publish"
          />
        </Button>
      </div>
    </section>
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
    buildUrlSlugCluster,
    savePublicationSlug,
    unpublish,
    unpublishPending,
  } = ctx;

  const pub = publication;
  if (!documentId) return null;

  return (
    <>
      {showPublishedPopoverActions && pub ? (
        <PublishedArticleSection
          publication={pub}
          buildUrlSlugCluster={buildUrlSlugCluster}
          savePublicationSlug={savePublicationSlug}
          busy={busy}
          publicationLoading={publicationLoading}
          editor={editor}
          publishFeedback={publishFeedback}
          handlePublish={handlePublish}
          hasChangesToPublish={hasChangesToPublish}
          unpublish={unpublish}
          unpublishPending={unpublishPending}
        />
      ) : (
        buildUrlSlugCluster("popover")
      )}

      {showPublishedPopoverActions ? null : (
        <Button
          type="button"
          className={cn(
            "w-full transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.98]",
            (busy || publishFeedback !== "idle") && "disabled:opacity-100",
          )}
          disabled={busy || !editor}
          onClick={() => {
            void handlePublish();
          }}
        >
          <SaveFeedbackLabel
            state={publishFeedbackToSaveState(publishFeedback)}
            idleLabel="Publish"
            savingLabel="Publishing..."
            savedLabel="Published"
            failedLabel="Failed to publish"
          />
        </Button>
      )}
    </>
  );
}
