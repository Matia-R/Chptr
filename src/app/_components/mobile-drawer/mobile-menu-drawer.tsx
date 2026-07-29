"use client";

import type { ReactNode } from "react";

import { Drawer, DrawerContent, DrawerTrigger } from "~/app/_components/drawer";
import { cn } from "~/lib/utils";

import { MOBILE_DRAWER_SHELL_CLASS } from "./constants";
import { useMobileDrawerKeyboardOffset } from "./use-mobile-drawer-keyboard";

export type MobileMenuDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Optional trigger; omit when the drawer is opened from external state. */
  trigger?: ReactNode;
  className?: string;
};

/**
 * Opinionated Vaul shell for drill-down mobile menus.
 *
 * Pins above the software keyboard via visual-viewport offset and sizes to
 * content — pair with `useMobileDrawerStage` + `MobileDrawerViewStack`.
 */
export function MobileMenuDrawer({
  open,
  onOpenChange,
  children,
  trigger,
  className,
}: MobileMenuDrawerProps) {
  const { keyboardOffset, drawerStyle } = useMobileDrawerKeyboardOffset(open);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}

      <DrawerContent
        bottomUnderlay={keyboardOffset > 0}
        bottomUnderlayHeight={keyboardOffset}
        style={drawerStyle}
        className={cn(MOBILE_DRAWER_SHELL_CLASS, className)}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}
