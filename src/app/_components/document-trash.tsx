"use client";

import { useState, type CSSProperties } from "react";

import {
  AppModalFrame,
  appModalHeaderClassName,
} from "~/app/_components/app-modal";
import { Button } from "~/app/_components/button";
import { DialogTitle } from "~/app/_components/dialog";
import {
  MobileDrawerScreenHeader,
  MobileMenuDrawer,
} from "~/app/_components/mobile-drawer";
import { PanelHeader } from "~/app/_components/panel-header";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useDocumentTrashStore } from "~/hooks/use-document-trash";
import { useTrashedDocuments } from "~/hooks/use-known-document-name";
import { useIsMobile } from "~/hooks/use-mobile";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
  type SaveFeedbackState,
} from "~/hooks/use-save-feedback";
import { useRestoreDocument } from "~/hooks/use-trash-document";
import { cn } from "~/lib/utils";

export const TRASH_DISCLAIMER =
  "Documents in Trash are permanently deleted after 30 days unless you restore them.";

/** Title + date + py-3 + row rule. Same slide as the sidebar document list. */
const TRASH_DOC_ROW_STRIDE = 61;

function formatTrashDeletedAt(iso: string): string {
  const deleted = new Date(iso);
  if (Number.isNaN(deleted.getTime())) return "Deleted";
  const days = Math.floor((Date.now() - deleted.getTime()) / 86_400_000);
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted yesterday";
  return `Deleted ${days} days ago`;
}

function TrashDocumentsList({
  insetClassName,
  restoringId,
  restoreState,
  isOffline,
  onRestore,
}: {
  insetClassName: string;
  restoringId: string | null;
  restoreState: SaveFeedbackState;
  isOffline: boolean;
  onRestore: (id: string, name: string) => void;
}) {
  const documents = useTrashedDocuments();

  if (documents.length === 0) {
    return (
      <p
        className={cn(
          "py-8 text-center text-sm text-muted-foreground",
          insetClassName,
        )}
      >
        Trash is empty
      </p>
    );
  }

  return (
    <ul
      className="relative"
      style={
        {
          "--item-count": documents.length,
          "--row-stride": `${TRASH_DOC_ROW_STRIDE}px`,
          height: "calc(var(--item-count) * var(--row-stride))",
        } as CSSProperties
      }
    >
      {documents.map((doc, index) => (
        <li
          key={doc.id}
          className={cn(
            "ease-[cubic-bezier(0.4,0,0.2,1)] absolute inset-x-0 top-0 flex h-[var(--row-stride)] items-center gap-3 border-b border-sidebar-border/60 py-3 last:border-b-0 transform transition-transform duration-300",
            insetClassName,
          )}
          style={
            {
              "--index": index,
              transform: "translateY(calc(var(--index) * var(--row-stride)))",
            } as CSSProperties
          }
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-sidebar-foreground">
              {doc.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTrashDeletedAt(doc.deletedAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "shrink-0 min-w-[5.75rem] cursor-pointer",
              restoringId === doc.id &&
                restoreState !== "idle" &&
                "disabled:opacity-100",
            )}
            disabled={isOffline || restoringId !== null}
            onClick={() => {
              onRestore(doc.id, doc.name);
            }}
          >
            <SaveFeedbackLabel
              state={restoringId === doc.id ? restoreState : "idle"}
              idleLabel="Restore"
              savingLabel="Restoring"
              savedLabel="Restored"
            />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function useTrashRestore() {
  const { restore, revealInList } = useRestoreDocument();
  const isOffline = useBrowserOffline();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const feedback = useSaveFeedback();

  const onRestore = async (id: string, name: string) => {
    if (isOffline || restoringId) return;
    setRestoringId(id);
    feedback.start();
    const ok = await restore(id, name, {
      openDocument: false,
      updateList: false,
      notify: false,
    });
    await feedback.settle(ok ? "saved" : "failed");
    if (!ok) {
      setRestoringId(null);
      return;
    }
    window.setTimeout(() => {
      revealInList(id, name);
      setRestoringId(null);
    }, SAVE_FEEDBACK_SETTLE_MS);
  };

  return {
    isOffline,
    restoringId,
    restoreState: feedback.state,
    onRestore,
  };
}

function DocumentTrashDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isOffline, restoringId, restoreState, onRestore } = useTrashRestore();

  return (
    <AppModalFrame
      open={open}
      onOpenChange={onOpenChange}
      srDescription="View and restore documents in Trash."
    >
      <PanelHeader
        titleAs={DialogTitle}
        title="Trash"
        description={TRASH_DISCLAIMER}
        className={cn(appModalHeaderClassName, "items-start")}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <TrashDocumentsList
          insetClassName="px-6"
          restoringId={restoringId}
          restoreState={restoreState}
          isOffline={isOffline}
          onRestore={(id, name) => {
            void onRestore(id, name);
          }}
        />
      </div>
    </AppModalFrame>
  );
}

function DocumentTrashDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isOffline, restoringId, restoreState, onRestore } = useTrashRestore();

  return (
    <MobileMenuDrawer open={open} onOpenChange={onOpenChange}>
      <div className="pb-6">
        <MobileDrawerScreenHeader title="Trash" subtitle={TRASH_DISCLAIMER} />
        <div className="max-h-[min(50vh,24rem)] overflow-y-auto">
          <TrashDocumentsList
            insetClassName="px-4"
            restoringId={restoringId}
            restoreState={restoreState}
            isOffline={isOffline}
            onRestore={(id, name) => {
              void onRestore(id, name);
            }}
          />
        </div>
      </div>
    </MobileMenuDrawer>
  );
}

/** Trash: a centered modal on desktop, a bottom drawer on mobile. */
export function DocumentTrash() {
  const isOpen = useDocumentTrashStore((state) => state.isOpen);
  const setOpen = useDocumentTrashStore((state) => state.setOpen);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DocumentTrashDrawer open={isOpen} onOpenChange={setOpen} />;
  }

  return <DocumentTrashDialog open={isOpen} onOpenChange={setOpen} />;
}
