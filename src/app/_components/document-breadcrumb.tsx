"use client";

import { api } from "~/trpc/react";
import { useRouteDocumentId } from "~/hooks/use-route-document-id";
import { BreadcrumbItem, Breadcrumb, BreadcrumbList } from "./breadcrumb";
import { useState } from "react";
import * as React from "react";
import { cn } from "~/lib/utils";
import { useToast } from "../../hooks/use-toast";
import { SquarePen, X } from "lucide-react";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { useDocumentIsPersisted } from "~/app/_components/editor/collaborative-doc-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { Input } from "~/app/_components/input";
import {
  focusMobileDrawerInput,
  MobileFormDrawer,
  runWithMobileDrawerOpenSync,
} from "~/app/_components/mobile-drawer";
import { useIsMobile } from "~/hooks/use-mobile";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useKnownDocumentName } from "~/hooks/use-known-document-name";
import {
  applyDocumentName,
  broadcastDocumentName,
} from "~/hooks/use-document-meta-sync";

function getCachedDocumentName(
  utils: ReturnType<typeof api.useUtils>,
  documentId: string,
) {
  return (
    utils.document.getDocumentById.getData(documentId)?.document?.name ??
    utils.document.getDocumentIdsForAuthenticatedUser
      .getData()
      ?.documents?.find((doc) => doc.id === documentId)?.name
  );
}

export function DocumentBreadcrumb() {
  const documentId = useRouteDocumentId() ?? "";
  const { isNew, clearFlag } = useNewDocumentFlag();
  const isPersisted = useDocumentIsPersisted(documentId);
  const isMobile = useIsMobile();
  const isOffline = useBrowserOffline();
  const utils = api.useUtils();
  const { toast } = useToast();
  const knownName = useKnownDocumentName(documentId);

  const { data: document, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && (!isNew || isPersisted),
    },
  );

  const fetchedName = document?.document?.name;
  const resolvedName =
    fetchedName ?? knownName ?? (isNew ? "Untitled" : undefined);

  const closingWithoutCommitRef = React.useRef(false);
  /** Enter already ran commitTitle; skip duplicate if onOpenChange(false) follows. */
  const skipCommitOnNextCloseRef = React.useRef(false);

  const updateName = api.document.updateDocumentName.useMutation({
    onMutate: ({ id, name }) => {
      const previousName =
        getCachedDocumentName(utils, id) ?? resolvedName ?? "Untitled";
      applyDocumentName(utils, id, name);
      broadcastDocumentName(id, name);
      return { previousName, optimisticName: name };
    },
    onError: (err, { id }, context) => {
      if (
        context &&
        getCachedDocumentName(utils, id) === context.optimisticName
      ) {
        setEditingName(context.previousName);
        applyDocumentName(utils, id, context.previousName);
        broadcastDocumentName(id, context.previousName);
      }

      toast({
        variant: "destructive",
        title: "Failed to update document name",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    },
    onSettled: (_data, _error, { id }, context) => {
      const cachedName = getCachedDocumentName(utils, id);
      if (
        context &&
        cachedName !== undefined &&
        cachedName !== context.optimisticName &&
        cachedName !== context.previousName
      ) {
        return;
      }

      void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
      void utils.document.getDocumentById.invalidate(id);
    },
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingName, setEditingName] = useState("Untitled");
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditingName(resolvedName ?? "");
  }, [documentId, resolvedName]);

  React.useEffect(() => {
    if (!popoverOpen) return;
    const id = window.requestAnimationFrame(() => {
      const el = titleInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [popoverOpen]);

  const persistName = React.useCallback(
    (trimmedName: string) => {
      if (isNew) {
        clearFlag();
      }

      setEditingName(trimmedName);
      updateName.mutate({ id: documentId, name: trimmedName });
    },
    [clearFlag, documentId, isNew, updateName],
  );

  const commitTitle = React.useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      const currentName = resolvedName ?? "Untitled";

      if (!trimmedName || trimmedName === currentName) {
        setEditingName(currentName);
        return;
      }

      persistName(trimmedName);
    },
    [persistName, resolvedName],
  );

  const handleCancel = React.useCallback(() => {
    closingWithoutCommitRef.current = true;
    setEditingName(resolvedName ?? "Untitled");
    setPopoverOpen(false);
  }, [resolvedName]);

  const openTitleEditor = React.useCallback(() => {
    if (isOffline) return;
    setEditingName(resolvedName ?? "Untitled");
    if (isMobile) {
      runWithMobileDrawerOpenSync(() => {
        setDrawerOpen(true);
      });
      // Controlled open can't recover the gesture after the fact — focus here
      // (FieldView layout-effect also runs during the sync mount).
      focusMobileDrawerInput(titleInputRef.current);
    } else {
      setPopoverOpen(true);
    }
  }, [isMobile, isOffline, resolvedName]);

  React.useEffect(() => {
    if (!isOffline) return;
    setPopoverOpen(false);
    setDrawerOpen(false);
  }, [isOffline]);

  const sharedStyles =
    "min-w-0 w-full max-w-full py-1 px-2 rounded-sm text-sm text-foreground font-semibold outline-none";

  if (isLoading && !isNew && !resolvedName) {
    return (
      <Breadcrumb className="w-full min-w-0 max-w-full flex-1 overflow-hidden">
        <BreadcrumbList className="min-w-0 flex-nowrap">
          <BreadcrumbItem className="w-full min-w-0 max-w-full flex-1">
            <div
              className={cn(
                sharedStyles,
                "h-4 w-full max-w-[24rem] animate-pulse bg-accent",
              )}
            />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const isEditingTitle = popoverOpen || drawerOpen;
  const titleName = isEditingTitle ? editingName : resolvedName;
  const displayName =
    titleName !== undefined && titleName.length > 0 ? titleName : "Untitled";

  const titleTrigger = (
    <button
      type="button"
      disabled={isOffline}
      className={cn(
        sharedStyles,
        "flex w-full min-w-0 items-center gap-2 pr-2 text-left",
        !isOffline && "hover:bg-accent hover:text-accent-foreground",
        isOffline && "cursor-default disabled:opacity-100",
      )}
      title={displayName}
      onClick={openTitleEditor}
    >
      <span className="min-w-0 flex-1 truncate">{displayName}</span>
      {!isOffline ? (
        <SquarePen
          className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      ) : null}
    </button>
  );

  return (
    <Breadcrumb className="w-full min-w-0 max-w-full flex-1 overflow-hidden">
      <BreadcrumbList className="min-w-0 flex-nowrap">
        <BreadcrumbItem className="w-full min-w-0 max-w-full flex-1">
          {isMobile ? (
            <>
              <div className="group relative min-w-0">{titleTrigger}</div>
              <MobileFormDrawer
                open={drawerOpen}
                onOpenChange={(open) => {
                  if (open && isOffline) return;
                  setDrawerOpen(open);
                }}
                title="Edit title"
                initialValue={resolvedName ?? "Untitled"}
                onCommit={commitTitle}
                inputId="document-title-mobile"
                inputLabel="Document title"
                inputRef={titleInputRef}
              />
            </>
          ) : (
            <Popover
              open={popoverOpen}
              onOpenChange={(open) => {
                if (open && isOffline) return;
                if (open) {
                  closingWithoutCommitRef.current = false;
                  skipCommitOnNextCloseRef.current = false;
                  setEditingName(resolvedName ?? "Untitled");
                  setPopoverOpen(true);
                  return;
                }
                if (closingWithoutCommitRef.current) {
                  closingWithoutCommitRef.current = false;
                } else if (skipCommitOnNextCloseRef.current) {
                  skipCommitOnNextCloseRef.current = false;
                } else {
                  commitTitle(editingName);
                }
                setPopoverOpen(false);
              }}
            >
              <div className="group relative min-w-0">
                <PopoverTrigger asChild>{titleTrigger}</PopoverTrigger>
              </div>

              <PopoverContent
                align="start"
                side="bottom"
                sideOffset={8}
                alignOffset={-8}
                className={cn(
                  "w-[min(100vw-2rem,28rem)] max-w-[min(100vw-2rem,28rem)] border-border bg-sidebar p-2 shadow-lg",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => {
                  e.preventDefault();
                  handleCancel();
                }}
              >
                <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-background pr-1 shadow-sm">
                  <Input
                    ref={titleInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitTitle(editingName);
                        skipCommitOnNextCloseRef.current = true;
                        setPopoverOpen(false);
                      }
                    }}
                    className="h-8 flex-1 border-0 bg-transparent px-2 py-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                    aria-label="Document title"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={handleCancel}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="Cancel rename"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
