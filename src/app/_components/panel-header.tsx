"use client";

import type { ElementType, ReactNode } from "react";

import { cn } from "~/lib/utils";

const PANEL_HEADER_TITLE_CLASS =
  "text-lg font-semibold leading-none tracking-tight";

export type PanelHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing controls, aligned to the right of the title (e.g. a Save button). */
  action?: ReactNode;
  /**
   * Element or component to render the heading as. Pass Radix `DialogTitle`
   * inside a dialog so the surface gets a proper accessible name.
   */
  titleAs?: ElementType;
  className?: string;
};

/**
 * Standard header for desktop panels — popovers, modals, and full screens.
 * Use this rather than hand-rolling a title so headings stay consistent.
 */
export function PanelHeader({
  title,
  description,
  action,
  titleAs: Title = "h2",
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col space-y-1.5 text-center sm:text-left">
        <Title className={PANEL_HEADER_TITLE_CLASS}>{title}</Title>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}
