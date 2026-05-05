"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { MoreVertical } from "lucide-react";
import { Button } from "./button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Skeleton } from "./skeleton";
import {
  DocumentPublishMobileDrawerPanel,
  useDocumentPublish,
} from "./editor/document-publish";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useIsMobile } from "~/hooks/use-mobile";

export function DocumentActions() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { isNew } = useNewDocumentFlag();
  const isMobile = useIsMobile();
  const publishCtx = useDocumentPublish();
  const [localDrawerOpen, setLocalDrawerOpen] = useState(false);

  const drawerOpen = publishCtx?.mobileDrawerOpen ?? localDrawerOpen;
  const setDrawerOpen = (next: boolean) => {
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

  if (isMobile) {
    return (
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="max-h-[90vh] overflow-y-auto p-0">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-sidebar-foreground">
              Publish
            </DrawerTitle>
          </DrawerHeader>
          <div className="border-b border-border px-4 pb-4">{statusText}</div>
          {publishCtx ? (
            <div className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground dark:border-sidebar-border">
              <DocumentPublishMobileDrawerPanel />
            </div>
          ) : null}
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
