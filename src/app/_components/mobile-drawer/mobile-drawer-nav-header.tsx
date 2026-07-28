"use client";

import type * as React from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "~/app/_components/button";
import { DrawerTitle } from "~/app/_components/drawer";
import { cn } from "~/lib/utils";

import { MOBILE_DRAWER_TITLE_CLASS } from "./constants";

export type MobileDrawerNavHeaderProps = {
  title: string;
  onBack: () => void;
  onDone: () => void;
  /** "Cancel" (no chevron) for standalone edit drawers; "Back" (with chevron) for drill-down. */
  backLabel?: string;
  /** A node so callers can pair the label with a spinner or checkmark. */
  doneLabel?: React.ReactNode;
  /** Disables Back (and Done when `doneDisabled` is omitted). */
  disabled?: boolean;
  /** Independent Done disable — e.g. nothing to save, or username taken. */
  doneDisabled?: boolean;
  /** Keeps Done undimmed during save feedback while still blocking presses. */
  doneClassName?: string;
  className?: string;
};

/** Back / centered title / Done chrome for nested mobile drawer screens. */
export function MobileDrawerNavHeader({
  title,
  onBack,
  onDone,
  backLabel = "Back",
  doneLabel = "Done",
  disabled = false,
  doneDisabled,
  doneClassName,
  className,
}: MobileDrawerNavHeaderProps) {
  const showBackChevron = backLabel !== "Cancel";
  const isDoneDisabled = doneDisabled ?? disabled;

  return (
    <header
      className={cn(
        "flex min-h-[52px] shrink-0 items-center justify-between gap-3 px-4 py-3",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-11 min-h-[44px] shrink-0 px-2 text-[17px] font-normal text-muted-foreground",
          showBackChevron && "gap-1",
        )}
        disabled={disabled}
        onClick={onBack}
      >
        {showBackChevron ? (
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        ) : null}
        {backLabel}
      </Button>
      <DrawerTitle
        className={cn(MOBILE_DRAWER_TITLE_CLASS, "min-w-0 flex-1 text-center")}
      >
        {title}
      </DrawerTitle>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-11 min-h-[44px] shrink-0 px-3 text-[17px] font-semibold transition-[transform,opacity] duration-200 ease-out active:scale-[0.98]",
          doneClassName,
        )}
        disabled={isDoneDisabled}
        onClick={onDone}
      >
        {doneLabel}
      </Button>
    </header>
  );
}
