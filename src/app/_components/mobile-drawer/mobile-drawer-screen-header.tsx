"use client";

import type { ReactNode } from "react";

import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";
import { cn } from "~/lib/utils";

import { MOBILE_DRAWER_TITLE_CLASS } from "./constants";

export type MobileDrawerScreenHeaderProps = {
  title: string;
  description?: string;
  subtitle?: ReactNode;
  className?: string;
};

/** Primary screen title for the root view of a mobile drawer menu. */
export function MobileDrawerScreenHeader({
  title,
  description,
  subtitle,
  className,
}: MobileDrawerScreenHeaderProps) {
  return (
    <>
      <DrawerHeader className={cn("text-left", className)}>
        <DrawerTitle className={MOBILE_DRAWER_TITLE_CLASS}>{title}</DrawerTitle>
        {description ? (
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        ) : null}
      </DrawerHeader>
      {subtitle ? (
        <div className="px-4 pb-4 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </>
  );
}
