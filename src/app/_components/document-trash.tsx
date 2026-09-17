"use client";

import { useState } from "react";

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
import { Skeleton } from "~/app/_components/skeleton";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useDocumentTrashStore } from "~/hooks/use-document-trash";
import { useIsMobile } from "~/hooks/use-mobile";
import { useRestoreDocument } from "~/hooks/use-trash-document";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export const TRASH_DISCLAIMER =
  "Documents in Trash are permanently deleted after 30 days unless you restore them.";

function formatTrashDeletedAt(iso: string): string {
  const deleted = new Date(iso);
  if (Number.isNaN(deleted.getTime())) return "Deleted";
  const days = Math.floor((Date.now() - deleted.getTime()) / 86_400_000);
  if (days <= 0) return "Deleted today";
  if (days === 1) return "Deleted yesterday";
  return `Deleted ${days} days ago`;
}

function TrashDocumentsList({
  enabled,
  insetClassName,
  restoringId,
  isOffline,
  onRestore,
}: {
  enabled: boolean;
  insetClassName: string;
  restoringId: string | null;
  isOffline: boolean;
  onRestore: (id: string, name: string) => void;
}) {
  const { data, isLoading } = api.document.getTrashedDocuments.useQuery(
    undefined,
    { enabled },
  );
  const documents = data?.documents ?? [];

  if (!enabled || isLoading) {
    return (
      <div className={cn("space-y-3 py-4", insetClassName)}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

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
    <ul className="flex flex-col">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className={cn(
            "flex items-center gap-3 border-b border-sidebar-border/60 py-3 last:border-b-0",
            insetClassName,
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-sidebar-foreground">{doc.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatTrashDeletedAt(doc.deletedAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 cursor-pointer"
            disabled={isOffline || restoringId === doc.id}
            onClick={() => {
              onRestore(doc.id, doc.name);
            }}
          >
            {restoringId === doc.id ? "Restoring..." : "Restore"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function useTrashRestore() {
  const { restore } = useRestoreDocument();
  const isOffline = useBrowserOffline();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const onRestore = async (id: string, name: string) => {
    if (isOffline || restoringId) return;
    setRestoringId(id);
    try {
      await restore(id, name, { openDocument: false });
    } finally {
      setRestoringId(null);
    }
  };

  return { isOffline, restoringId, onRestore };
}

function DocumentTrashDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isOffline, restoringId, onRestore } = useTrashRestore();

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
          enabled={open}
          insetClassName="px-6"
          restoringId={restoringId}
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
  const { isOffline, restoringId, onRestore } = useTrashRestore();

  return (
    <MobileMenuDrawer open={open} onOpenChange={onOpenChange}>
      <div className="pb-6">
        <MobileDrawerScreenHeader
          title="Trash"
          subtitle={TRASH_DISCLAIMER}
        />
        <div className="max-h-[min(50vh,24rem)] overflow-y-auto">
          <TrashDocumentsList
            enabled={open}
            insetClassName="px-4"
            restoringId={restoringId}
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
