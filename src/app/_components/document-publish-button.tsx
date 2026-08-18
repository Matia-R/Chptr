"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Globe, Loader2, RefreshCw } from "lucide-react";
import { Button } from "~/app/_components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import {
  DocumentPublishPopoverPanel,
  useDocumentPublish,
} from "~/app/_components/editor/document-publish";
import { SAVE_FEEDBACK_CONTENT_TRANSITION } from "~/app/_components/save-feedback-label";
import { Skeleton } from "~/app/_components/skeleton";
import { cn } from "~/lib/utils";

/** Resting labels only — wrapper width must not include transitional copy. */
const RESTING_TRIGGER_LABELS = ["Publish", "Published", "Update"] as const;

function getTriggerLabel(options: {
  publishFeedback: string;
  publishButtonLabel: string;
  showPublishedPopoverActions: boolean;
}): string {
  if (options.publishFeedback === "publishing") {
    return options.showPublishedPopoverActions ? "Updating" : "Publishing";
  }
  if (options.publishButtonLabel === "Publishing...") {
    return "Publishing";
  }
  return options.publishButtonLabel;
}

export function DocumentPublishButton() {
  const ctx = useDocumentPublish();

  if (!ctx) return null;

  const {
    editor,
    popoverOpen,
    setPopoverOpen,
    onAuxiliaryOpenChange,
    publishButtonLabel,
    hasChangesToPublish,
    publication,
    publishFeedback,
    showPublishedPopoverActions,
    busy,
    publicationLoading,
  } = ctx;

  const triggerLabel = getTriggerLabel({
    publishFeedback,
    publishButtonLabel,
    showPublishedPopoverActions,
  });
  const isProgress =
    triggerLabel === "Updating" || triggerLabel === "Publishing";
  const TriggerIcon =
    triggerLabel === "Published"
      ? Check
      : triggerLabel === "Update"
        ? RefreshCw
        : Globe;

  const widthSizer = (
    <span
      className="invisible inline-flex h-8 items-center gap-1 px-2 py-1 text-sm font-medium"
      aria-hidden
    >
      <span className="size-3.5 shrink-0" />
      <span className="grid justify-items-start">
        {RESTING_TRIGGER_LABELS.map((label) => (
          <span
            key={label}
            className="col-start-1 row-start-1 whitespace-nowrap"
          >
            {label}
          </span>
        ))}
      </span>
      <ChevronDown className="size-3.5 shrink-0" />
    </span>
  );

  if (publicationLoading) {
    return (
      <div
        className="pointer-events-none relative mr-2 inline-flex shrink-0"
        aria-busy="true"
        aria-label="Loading publishing status"
      >
        {widthSizer}
        <span className="absolute right-0 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 px-2 py-1">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <span className="relative inline-grid">
            <span className="invisible col-start-1 row-start-1 whitespace-nowrap text-sm font-medium">
              Published
            </span>
            <Skeleton className="col-start-1 row-start-1 h-3.5 self-center" />
          </span>
          <ChevronDown
            className="size-3.5 text-muted-foreground/40"
            aria-hidden
          />
        </span>
      </div>
    );
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(next) => {
        if (busy && next) return;
        setPopoverOpen(next);
        onAuxiliaryOpenChange(next);
      }}
    >
      <div className="pointer-events-none relative mr-2 inline-flex shrink-0">
        {widthSizer}

        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "pointer-events-auto absolute right-0 top-1/2 h-8 -translate-y-1/2 gap-1 rounded-md px-2 py-1 text-sm font-medium shadow-none",
              "whitespace-nowrap",
              "opacity-100 transition-[color,background-color,opacity] duration-200 ease-out",
              "hover:bg-accent hover:text-accent-foreground",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              "[&_svg]:size-3.5",
              (busy || publishFeedback !== "idle") && "disabled:opacity-100",
              !editor &&
                !busy &&
                publishFeedback === "idle" &&
                "opacity-50 disabled:opacity-50",
              !hasChangesToPublish &&
                publication &&
                publishFeedback === "idle" &&
                "text-muted-foreground",
            )}
            disabled={!editor || busy}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={triggerLabel}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
                className="inline-flex items-center gap-1"
              >
                <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                  {isProgress ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <TriggerIcon aria-hidden />
                  )}
                </span>
                <span className="whitespace-nowrap">{triggerLabel}</span>
              </motion.span>
            </AnimatePresence>
            <ChevronDown aria-hidden />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "relative w-[min(100vw-2rem,28rem)] max-w-md overflow-x-hidden border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground shadow-lg",
          "grid gap-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        )}
      >
        <DocumentPublishPopoverPanel />
      </PopoverContent>
    </Popover>
  );
}
