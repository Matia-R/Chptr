"use client";

import { Check } from "lucide-react";
import { forwardRef, useState } from "react";

import { Button, type ButtonProps } from "~/app/_components/button";
import {
  MobileDrawerScreenHeader,
  MobileMenuDrawer,
} from "~/app/_components/mobile-drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { HoverTooltip } from "~/app/_components/tooltip";
import { useDocumentFont } from "~/hooks/use-document-font";
import { useIsMobile } from "~/hooks/use-mobile";
import { DOCUMENT_FONTS, type DocumentFontId } from "~/lib/document-fonts";
import { cn } from "~/lib/utils";

const triggerClassName = cn(
  "h-8 shrink-0 rounded-md px-2 py-1 font-sans text-sm font-medium leading-none shadow-none",
  "opacity-100 transition-[color,background-color,opacity] duration-200 ease-out",
  "hover:bg-accent hover:text-accent-foreground",
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
);

const DocumentFontTrigger = forwardRef<HTMLButtonElement, ButtonProps>(
  function DocumentFontTrigger(props, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        type="button"
        variant="ghost"
        aria-label="Document font"
        className={cn(triggerClassName, props.className)}
      >
        Aa
      </Button>
    );
  },
);

function DocumentFontOptions({
  fontId,
  ready,
  onSelect,
  className,
}: {
  fontId: DocumentFontId | null;
  ready: boolean;
  onSelect: (fontId: DocumentFontId) => void;
  className?: string;
}) {
  return (
    <div
      role="listbox"
      aria-label="Font"
      aria-busy={!ready}
      className={cn("grid gap-0.5", className)}
    >
      {DOCUMENT_FONTS.map((font) => {
        const selected = fontId === font.id;
        return (
          <button
            key={font.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={!ready}
            onClick={() => onSelect(font.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left outline-none transition-colors",
              "hover:bg-sidebar-accent focus-visible:bg-sidebar-accent active:bg-sidebar-accent",
              "disabled:pointer-events-none",
              selected && "bg-sidebar-accent",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className="whitespace-nowrap text-[1.375rem] font-normal leading-[1.2]"
                style={{ fontFamily: font.family }}
              >
                {font.name}
              </span>
              <span className="font-sans text-xs leading-4 text-muted-foreground">
                {font.category}
              </span>
            </span>
            <Check
              className={cn(
                "size-4 shrink-0",
                selected ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

export function DocumentFontButton() {
  const isMobile = useIsMobile();
  const { fontId, ready, selectFont } = useDocumentFont();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <MobileMenuDrawer
        open={open}
        onOpenChange={setOpen}
        trigger={<DocumentFontTrigger />}
      >
        <div className="pb-6">
          <MobileDrawerScreenHeader
            title="Font"
            description="Choose a document font"
          />
          <DocumentFontOptions
            fontId={fontId}
            ready={ready}
            onSelect={selectFont}
            className="px-2"
          />
        </div>
      </MobileMenuDrawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <HoverTooltip side="bottom" content="Document font">
        <PopoverTrigger asChild>
          <DocumentFontTrigger />
        </PopoverTrigger>
      </HoverTooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        className="w-[min(18.75rem,calc(100vw-1rem))] border-sidebar-border bg-sidebar px-6 py-3 text-sidebar-foreground shadow-lg"
      >
        <DocumentFontOptions
          fontId={fontId}
          ready={ready}
          onSelect={selectFont}
          className="-mx-3"
        />
      </PopoverContent>
    </Popover>
  );
}
