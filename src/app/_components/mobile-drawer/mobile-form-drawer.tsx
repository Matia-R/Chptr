"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Drawer, DrawerContent, DrawerTrigger } from "~/app/_components/drawer";
import { Input } from "~/app/_components/input";
import { cn } from "~/lib/utils";

import { MOBILE_DRAWER_SHELL_CLASS } from "./constants";
import { MobileDrawerEditBody } from "./mobile-drawer-edit-body";
import { MobileDrawerNavHeader } from "./mobile-drawer-nav-header";
import {
  applyMobileDrawerKeyboardInset,
  focusMobileDrawerInput,
  resetMobileDrawerKeyboardStyles,
  waitForMobileDrawerKeyboardDismiss,
} from "./utils";

export type MobileFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue: string;
  onCommit: (value: string) => void;
  inputId?: string;
  inputLabel?: string;
  helperText?: string;
  disabled?: boolean;
  trigger?: React.ReactNode;
  contentClassName?: string;
};

/**
 * Single-screen mobile drawer for editing a text field (title, slug, etc.).
 * Matches publish drawer edit screens: nav header, padded field, keyboard handling.
 */
export function MobileFormDrawer({
  open,
  onOpenChange,
  title,
  initialValue,
  onCommit,
  inputId = "mobile-form-drawer-input",
  inputLabel,
  helperText,
  disabled = false,
  trigger,
  contentClassName,
}: MobileFormDrawerProps) {
  const [draft, setDraft] = useState(initialValue);
  const snapshotRef = useRef(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      snapshotRef.current = initialValue;
      setDraft(initialValue);
    }
    wasOpenRef.current = open;
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      focusMobileDrawerInput(inputRef.current);
      window.setTimeout(() => {
        applyMobileDrawerKeyboardInset();
      }, 50);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const closeDrawer = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const leave = useCallback(
    (commit: boolean) => {
      inputRef.current?.blur();
      const trimmed = draft.trim();

      waitForMobileDrawerKeyboardDismiss(() => {
        resetMobileDrawerKeyboardStyles();
        if (commit) {
          onCommit(trimmed);
        } else {
          setDraft(snapshotRef.current);
        }
        closeDrawer();
      });
    },
    [closeDrawer, draft, onCommit],
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    leave(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} repositionInputs={open}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent className={MOBILE_DRAWER_SHELL_CLASS}>
        <MobileDrawerNavHeader
          title={title}
          disabled={disabled}
          backLabel="Cancel"
          onBack={() => leave(false)}
          onDone={() => leave(true)}
        />
        <MobileDrawerEditBody
          helperText={helperText}
          className={contentClassName}
        >
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                leave(true);
              }
            }}
            className={cn(
              "h-10 w-full rounded-lg border border-sidebar-border/70 bg-background/50 px-3 text-base shadow-inner",
              "dark:border-white/[0.12] dark:bg-black/35",
              "focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label={inputLabel ?? title}
          />
        </MobileDrawerEditBody>
      </DrawerContent>
    </Drawer>
  );
}
