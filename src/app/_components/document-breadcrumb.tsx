"use client";

import { useParams } from "next/navigation";
import { flushSync } from "react-dom";
import { api } from "~/trpc/react";
import { BreadcrumbItem, Breadcrumb, BreadcrumbList } from "./breadcrumb";
import { useState } from "react";
import * as React from "react";
import { cn } from "~/lib/utils";
import { useToast } from "../../hooks/use-toast";
import { SquarePen, X } from "lucide-react";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { Input } from "~/app/_components/input";
import {
  applyMobileDrawerKeyboardInset,
  focusMobileDrawerInput,
  MobileFormDrawer,
} from "~/app/_components/mobile-drawer";
import { useIsMobile } from "~/hooks/use-mobile";

export function DocumentBreadcrumb() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { isNew, clearFlag } = useNewDocumentFlag();
  const isMobile = useIsMobile();
  const utils = api.useUtils();
  const { toast } = useToast();

  const { data: document, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && !isNew,
    },
  );

  const previousNameRef = React.useRef<string>("Untitled");
  const closingWithoutCommitRef = React.useRef(false);
  /** Enter already ran commitTitle; skip duplicate if onOpenChange(false) follows. */
  const skipCommitOnNextCloseRef = React.useRef(false);

  const updateName = api.document.updateDocumentName.useMutation({
    onError: (err) => {
      setEditingName(previousNameRef.current);

      toast({
        variant: "destructive",
        title: "Failed to update document name",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    },
    onSettled: () => {
      void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
      void utils.document.getDocumentById.invalidate(documentId);
    },
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingName, setEditingName] = useState("Untitled");
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (document?.document?.name) {
      setEditingName(document.document.name);
    } else if (isNew) {
      setEditingName("Untitled");
    } else {
      setEditingName("");
    }
  }, [documentId, document?.document?.name, isNew]);

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
      previousNameRef.current = document?.document?.name ?? "Untitled";

      if (isNew) {
        clearFlag();
      }

      setEditingName(trimmedName);

      utils.document.getDocumentIdsForAuthenticatedUser.setData(
        undefined,
        (old) => {
          if (!old?.documents) {
            return {
              success: true,
              documents: [{ id: documentId, name: trimmedName }],
            };
          }

          const exists = old.documents.some((doc) => doc.id === documentId);
          if (exists) {
            return {
              ...old,
              documents: old.documents.map((doc) =>
                doc.id === documentId ? { ...doc, name: trimmedName } : doc,
              ),
            };
          }
          return {
            ...old,
            documents: [
              { id: documentId, name: trimmedName },
              ...old.documents,
            ],
          };
        },
      );

      updateName.mutate({ id: documentId, name: trimmedName });
    },
    [
      clearFlag,
      document?.document?.name,
      documentId,
      isNew,
      updateName,
      utils.document.getDocumentIdsForAuthenticatedUser,
    ],
  );

  const commitTitle = React.useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      const currentName = document?.document?.name ?? "Untitled";

      if (!trimmedName || trimmedName === currentName) {
        setEditingName(currentName);
        return;
      }

      persistName(trimmedName);
    },
    [document?.document?.name, persistName],
  );

  const handleCancel = React.useCallback(() => {
    closingWithoutCommitRef.current = true;
    setEditingName(document?.document?.name ?? "Untitled");
    setPopoverOpen(false);
  }, [document?.document?.name]);

  const openTitleEditor = React.useCallback(() => {
    setEditingName(document?.document?.name ?? "Untitled");
    if (isMobile) {
      flushSync(() => {
        setDrawerOpen(true);
      });
      focusMobileDrawerInput(titleInputRef.current);
      window.setTimeout(() => {
        applyMobileDrawerKeyboardInset();
      }, 50);
    } else {
      setPopoverOpen(true);
    }
  }, [document?.document?.name, isMobile]);

  const sharedStyles =
    "min-w-0 w-full max-w-full py-1 px-2 rounded-sm text-sm text-foreground font-semibold outline-none";

  if (isLoading && !isNew) {
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

  const displayName = editingName || "Untitled";

  const titleTrigger = (
    <button
      type="button"
      className={cn(
        sharedStyles,
        "flex w-full min-w-0 items-center gap-2 pr-2 text-left hover:bg-accent hover:text-accent-foreground",
      )}
      title={displayName}
      onClick={openTitleEditor}
    >
      <span className="min-w-0 flex-1 truncate">{displayName}</span>
      <SquarePen
        className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
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
                onOpenChange={setDrawerOpen}
                title="Edit title"
                initialValue={document?.document?.name ?? "Untitled"}
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
                if (open) {
                  closingWithoutCommitRef.current = false;
                  skipCommitOnNextCloseRef.current = false;
                  setEditingName(document?.document?.name ?? "Untitled");
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
