"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { MoreVertical } from "lucide-react";
import { Button } from "./button";
import { Drawer, DrawerContent, DrawerTrigger } from "./drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Skeleton } from "./skeleton";
import {
  MOBILE_DRAWER_SHELL_CLASS,
  MobileDrawerScreenHeader,
} from "~/app/_components/mobile-drawer";
import {
  DocumentPublishMobileDrawer,
  useDocumentPublish,
} from "./editor/document-publish";
import { useDocumentPublishStore } from "./editor/document-publish-store";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useIsMobile } from "~/hooks/use-mobile";

function formatPublicationDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function DocumentActions() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { isNew } = useNewDocumentFlag();
  const isMobile = useIsMobile();
  const publishCtx = useDocumentPublish();
  const [localDrawerOpen, setLocalDrawerOpen] = useState(false);

  const drawerOpen = publishCtx?.mobileDrawerOpen ?? localDrawerOpen;
  const mobileDrawerView = useDocumentPublishStore((s) => s.mobileDrawerView);
  const setDrawerOpen = (next: boolean) => {
    if (!next) {
      useDocumentPublishStore.getState().setMobileDrawerView("main");
    }
    if (publishCtx) {
      publishCtx.onAuxiliaryOpenChange(next);
      publishCtx.setMobileDrawerOpen(next);
    } else {
      setLocalDrawerOpen(next);
    }
  };

  // Don't fetch for new documents
  const { data, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && !isNew,
    },
  );

  const renderContent = () => {
    // For new documents, show "No changes yet"
    if (isNew) {
      return <span>No changes yet</span>;
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-1">
          <span>Edited</span>
          <Skeleton className="h-4 w-24" />
        </div>
      );
    }

    if (!data?.document?.last_updated) {
      return <span>No changes yet</span>;
    }

    const lastUpdated = new Date(data.document.last_updated);
    const now = new Date();

    const monthDay = lastUpdated.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    const dateStr =
      lastUpdated.getFullYear() === now.getFullYear()
        ? monthDay
        : `${monthDay}, ${lastUpdated.getFullYear()}`;

    return <span>Edited {dateStr}</span>;
  };

  const triggerButton = (
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreVertical className="h-4 w-4" />
      <span className="sr-only">Open menu</span>
    </Button>
  );

  const statusText = (
    <div className="text-sm text-muted-foreground">{renderContent()}</div>
  );

  const mobileDrawerStatusRow = (() => {
    if (!publishCtx) {
      return renderContent();
    }
    if (publishCtx.publicationLoading && !publishCtx.publication) {
      return <Skeleton className="h-4 w-[min(100%,14rem)]" />;
    }
    if (publishCtx.publication) {
      const isOutOfDate =
        publishCtx.hasUnpublishedChanges || publishCtx.hasPendingSlugChange;
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span
            className={
              isOutOfDate
                ? "size-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-background"
                : "size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-background"
            }
            aria-hidden
          />
          <span>
            Live · {formatPublicationDate(publishCtx.publication.updated_at)}
            {isOutOfDate ? " · Out of date" : ""}
          </span>
        </span>
      );
    }
    return renderContent();
  })();

  if (isMobile) {
    return (
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        repositionInputs={mobileDrawerView === "edit-url"}
      >
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className={MOBILE_DRAWER_SHELL_CLASS}>
          {publishCtx ? (
            <DocumentPublishMobileDrawer statusRow={mobileDrawerStatusRow} />
          ) : (
            <MobileDrawerScreenHeader
              title="Publish"
              description="Publish and manage this article"
              subtitle={<span>No changes yet</span>}
            />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">{statusText}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
