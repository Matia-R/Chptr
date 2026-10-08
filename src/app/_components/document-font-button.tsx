"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "~/app/_components/button";
import { PanelHeader } from "~/app/_components/panel-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { HoverTooltip } from "~/app/_components/tooltip";
import { useDocumentFont } from "~/hooks/use-document-font";
import { DOCUMENT_FONTS, type DocumentFontId } from "~/lib/document-fonts";
import { cn } from "~/lib/utils";

export function DocumentFontButton() {
  const { fontId, ready, selectFont } = useDocumentFont();
  const [open, setOpen] = useState(false);

  const choose = (next: DocumentFontId) => {
    if (!selectFont(next)) return;
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <HoverTooltip side="bottom" content="Document font">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Document font"
            className={cn(
              "h-8 shrink-0 rounded-md px-2 py-1 font-sans text-sm font-medium leading-none shadow-none",
              "opacity-100 transition-[color,background-color,opacity] duration-200 ease-out",
              "hover:bg-accent hover:text-accent-foreground",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
            )}
          >
            Aa
          </Button>
        </PopoverTrigger>
      </HoverTooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        className="grid w-[min(18.75rem,calc(100vw-1rem))] gap-3 border-sidebar-border bg-sidebar px-6 pb-3 pt-6 text-sidebar-foreground shadow-lg"
      >
        <PanelHeader title="Font" />
        <div
          role="listbox"
          aria-label="Font"
          aria-busy={!ready}
          className="-mx-3 grid gap-0.5"
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
                onClick={() => choose(font.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left outline-none transition-colors",
                  "hover:bg-sidebar-accent focus-visible:bg-sidebar-accent",
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
      </PopoverContent>
    </Popover>
  );
}
