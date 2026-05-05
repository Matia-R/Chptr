"use client";

import { ChevronDown } from "lucide-react";
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
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/utils";

export function DocumentPublishButton() {
  const ctx = useDocumentPublish();
  const isMobile = useIsMobile();

  if (!ctx) return null;

  const {
    editor,
    popoverOpen,
    setPopoverOpen,
    onAuxiliaryOpenChange,
    publishButtonLabel,
    publishButtonIcon,
    hasChangesToPublish,
    busy,
    publicationLoading,
    publication,
    publishFeedback,
    handlePublish,
  } = ctx;

  return (
    <>
      {!isMobile ? (
        <Popover
          open={popoverOpen}
          onOpenChange={(next) => {
            setPopoverOpen(next);
            onAuxiliaryOpenChange(next);
          }}
        >
          <div
            className="inline-flex max-w-full shrink-0 items-stretch overflow-hidden rounded-sm border border-input bg-background transition-shadow duration-200 ease-out"
            title={
              !editor
                ? "Loading editor…"
                : publication
                  ? "Published — publish from the left or open options on the right"
                  : "Publish to web — publish from the left or open options on the right"
            }
          >
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-auto min-h-0 w-[130px] justify-start rounded-none py-1 pl-2 pr-2 text-sm shadow-none",
                "shrink-0 whitespace-nowrap",
                "transition-all duration-200 ease-out active:scale-[0.98]",
                !hasChangesToPublish &&
                  publication &&
                  publishFeedback === "idle" &&
                  "text-muted-foreground",
              )}
              disabled={
                !editor ||
                busy ||
                publicationLoading ||
                (!hasChangesToPublish && publishFeedback === "idle")
              }
              onClick={() => {
                void handlePublish();
              }}
            >
              <span className="inline-flex items-center gap-1.5 transition-all duration-150">
                {publishButtonIcon}
                <span>{publishButtonLabel}</span>
              </span>
            </Button>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto min-h-0 shrink-0 rounded-none border-l border-input py-1 pl-1 pr-1.5 text-sm shadow-none",
                  "transition-colors duration-150",
                )}
                disabled={!editor || publishFeedback === "publishing"}
                aria-label="Open publish options"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </PopoverTrigger>
          </div>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "relative w-[min(100vw-2rem,28rem)] max-w-md border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground shadow-lg",
              "grid gap-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <DocumentPublishPopoverPanel />
          </PopoverContent>
        </Popover>
      ) : (
        <div
          className="inline-flex max-w-full shrink-0 items-stretch overflow-hidden rounded-sm border border-input bg-background transition-shadow duration-200 ease-out"
          title={
            !editor
              ? "Loading editor…"
              : publication
                ? "Published — tap to publish updates"
                : "Publish to web"
          }
        >
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-auto min-h-0 w-[130px] justify-start rounded-none py-1 pl-2 pr-2 text-sm shadow-none",
              "shrink-0 whitespace-nowrap",
              "transition-all duration-200 ease-out active:scale-[0.98]",
              !hasChangesToPublish &&
                publication &&
                publishFeedback === "idle" &&
                "text-muted-foreground",
            )}
            disabled={
              !editor ||
              busy ||
              publicationLoading ||
              (!hasChangesToPublish && publishFeedback === "idle")
            }
            onClick={() => {
              void handlePublish();
            }}
          >
            <span className="inline-flex items-center gap-1.5 transition-all duration-150">
              {publishButtonIcon}
              <span>{publishButtonLabel}</span>
            </span>
          </Button>
        </div>
      )}
    </>
  );
}
