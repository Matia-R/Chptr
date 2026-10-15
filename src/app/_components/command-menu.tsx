"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandDialog,
  CommandGroup,
  CommandShortcut,
} from "./command";
import { useOpenDocumentPreview } from "./document-preview";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FilePlus,
  FileText,
  Globe,
  RefreshCw,
  SunMoon,
} from "lucide-react";
import { DialogTitle } from "./dialog";
import { useCommandMenuStore } from "~/hooks/use-command-menu";
import { markDocumentAsNew } from "~/hooks/use-new-document-flag";
import { usePrefetchDocumentState } from "~/hooks/use-prefetch-document-state";
import { useBrowserOffline } from "~/hooks/use-browser-offline";
import { useDocumentList } from "~/hooks/use-known-document-name";
import {
  applyDocumentCreated,
  broadcastDocumentCreated,
} from "~/hooks/use-document-meta-sync";
import { useTheme } from "next-themes";
import { randomUUID } from "~/lib/utils";
import { DOCUMENT_PUBLISH_SHORTCUT_LABEL } from "./document-publish-button";
import {
  isPublishRequestPending,
  useDocumentPublish,
  type DocumentPublishValue,
} from "~/hooks/use-document-publish";

function publishCommandLabel(ctx: DocumentPublishValue): "Publish" | "Update" {
  return ctx.showPublishedPopoverActions ? "Update" : "Publish";
}

/** Same gate as the Publish / Update buttons in the publish panel. */
function isPublishActionUnavailable(
  ctx: DocumentPublishValue,
  isOffline: boolean,
): boolean {
  return (
    isOffline ||
    isPublishRequestPending(ctx.documentId) ||
    ctx.busy ||
    !ctx.editor ||
    ctx.publicationLoading ||
    (!ctx.hasChangesToPublish && ctx.publishFeedback === "idle")
  );
}

export function CommandMenu() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { data: documents } = useDocumentList();
  const utils = api.useUtils();
  const isOpen = useCommandMenuStore((state) => state.isOpen);
  const setOpen = useCommandMenuStore((state) => state.setOpen);
  const closeAll = useCommandMenuStore((state) => state.closeAll);
  const prefetchDocumentState = usePrefetchDocumentState();
  const { theme, setTheme } = useTheme();
  const isOffline = useBrowserOffline();
  const { toggle: togglePreview, available: previewAvailable } =
    useOpenDocumentPreview();
  const publishCtx = useDocumentPublish();
  const publishCtxRef = useRef(publishCtx);
  publishCtxRef.current = publishCtx;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;

  // Instant document creation - navigate immediately with a new UUID
  const handleCreateDocument = useCallback(() => {
    if (isOffline) return;
    const newId = randomUUID();
    markDocumentAsNew(newId);
    applyDocumentCreated(utils, newId, "Untitled");
    broadcastDocumentCreated(newId, "Untitled");
    router.push(`/documents/${newId}`);
    closeAll();
  }, [router, closeAll, isOffline, utils]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        // Highlight the search text in the sidebar
        const searchButton = document.querySelector("[data-search-button]");
        if (searchButton) {
          searchButton.setAttribute("data-highlight", "true");
          setTimeout(() => {
            searchButton.setAttribute("data-highlight", "false");
          }, 1000);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.isComposing) return;
      if (!event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.key !== "Enter") return;

      const ctx = publishCtxRef.current;
      if (!ctx) return;

      // Capture so the editor doesn't also start a new block.
      event.preventDefault();
      event.stopPropagation();

      if (isPublishActionUnavailable(ctx, isOfflineRef.current)) return;

      useCommandMenuStore.getState().setOpen(false);
      void ctx.handlePublish();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const allDocs = documents?.documents ?? [];
  const displayedDocs = search ? allDocs : allDocs.slice(0, 5);

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command Menu</DialogTitle>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search or type a command..."
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Documents">
          {displayedDocs.map((doc) => (
            <CommandItem
              key={doc.id}
              value={doc.name + "_" + doc.id}
              onMouseEnter={() => prefetchDocumentState(doc.id)}
              onSelect={() => {
                prefetchDocumentState(doc.id);
                router.push(`/documents/${doc.id}`);
                closeAll();
              }}
            >
              <FileText aria-hidden />
              <span className="min-w-0 flex-1 truncate">{doc.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="new-document"
            disabled={isOffline}
            onSelect={handleCreateDocument}
          >
            <FilePlus aria-hidden />
            New document
          </CommandItem>
          {previewAvailable ? (
            <CommandItem
              value="preview"
              onSelect={() => {
                closeAll();
                togglePreview();
              }}
            >
              <BookOpen aria-hidden />
              Preview
              <CommandShortcut>⌘⇧P</CommandShortcut>
            </CommandItem>
          ) : null}
          {publishCtx ? (
            <CommandItem
              value="publish update document"
              disabled={isPublishActionUnavailable(publishCtx, isOffline)}
              onSelect={() => {
                if (isPublishActionUnavailable(publishCtx, isOffline)) return;
                closeAll();
                void publishCtx.handlePublish();
              }}
            >
              {publishCtx.showPublishedPopoverActions ? (
                <RefreshCw aria-hidden />
              ) : (
                <Globe aria-hidden />
              )}
              {publishCommandLabel(publishCtx)}
              <CommandShortcut>
                {DOCUMENT_PUBLISH_SHORTCUT_LABEL}
              </CommandShortcut>
            </CommandItem>
          ) : null}
          <CommandItem
            value="toggle-theme"
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              closeAll();
            }}
          >
            <SunMoon aria-hidden />
            Toggle theme
            <span className="ml-auto text-xs text-muted-foreground">
              Current: {theme}
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
