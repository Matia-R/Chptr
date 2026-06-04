"use client";

import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type MobileDrawerEditBodyProps = {
  children: ReactNode;
  helperText?: ReactNode;
  className?: string;
};

/** Padded content area for edit-field screens inside a mobile drawer. */
export function MobileDrawerEditBody({
  children,
  helperText,
  className,
}: MobileDrawerEditBodyProps) {
  return (
    <div className={cn("flex flex-col gap-4 px-4 pb-8 pt-6", className)}>
      {children}
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
