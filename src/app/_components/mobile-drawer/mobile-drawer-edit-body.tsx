"use client";

import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type MobileDrawerEditBodyProps = {
  children: ReactNode;
  /** Supporting copy under the field (muted). */
  helperText?: ReactNode;
  /** Id for `aria-describedby` when `helperText` is shown. */
  helperTextId?: string;
  /**
   * Validation or status message associated with the field (e.g. schema error,
   * username availability). Rendered above helper text when both are set.
   */
  description?: ReactNode;
  /** Id for `aria-describedby` when `description` is shown. */
  descriptionId?: string;
  className?: string;
};

/** Padded content area for edit-field screens inside a mobile drawer. */
export function MobileDrawerEditBody({
  children,
  helperText,
  helperTextId,
  description,
  descriptionId,
  className,
}: MobileDrawerEditBodyProps) {
  return (
    <div className={cn("flex flex-col gap-4 px-4 pb-8 pt-6", className)}>
      {children}
      {description ? (
        <div id={descriptionId} className="min-h-[1.25rem]">
          {description}
        </div>
      ) : null}
      {helperText ? (
        <p id={helperTextId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
