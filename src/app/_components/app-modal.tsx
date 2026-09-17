"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "~/app/_components/dialog";
import { cn } from "~/lib/utils";

/** Shared chrome for desktop app modals (Account, Trash). */
export const appModalShellClassName =
  "flex w-full max-w-2xl flex-col gap-0 overflow-hidden border-0 bg-sidebar p-0 shadow-2xl";

export const appModalHeightClassName = "h-[min(85vh,32.1rem)]";

export const appModalHeaderClassName = "shrink-0 py-5 pl-6 pr-12";

type AppModalFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  srDescription: string;
  children: ReactNode;
  className?: string;
} & Omit<
  ComponentPropsWithoutRef<typeof DialogContent>,
  "children" | "className"
>;

/** Centered desktop dialog shell used by Account and Trash. */
export function AppModalFrame({
  open,
  onOpenChange,
  srDescription,
  children,
  className,
  ...contentProps
}: AppModalFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          appModalShellClassName,
          appModalHeightClassName,
          className,
        )}
        {...contentProps}
      >
        <DialogDescription className="sr-only">{srDescription}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
