"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";

import { Drawer, DrawerContent, DrawerTrigger } from "~/app/_components/drawer";
import { Input } from "~/app/_components/input";
import { cn } from "~/lib/utils";

import { MOBILE_DRAWER_SHELL_CLASS } from "./constants";
import { MobileDrawerEditBody } from "./mobile-drawer-edit-body";
import { MobileDrawerNavHeader } from "./mobile-drawer-nav-header";

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
  inputRef?: MutableRefObject<HTMLInputElement | null>;
};

type DrawerKeyboardStyle = CSSProperties & {
  "--mobile-keyboard-offset"?: string;
};

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
  inputRef,
}: MobileFormDrawerProps) {
  const [draft, setDraft] = useState(initialValue);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState<
    number | null
  >(null);

  const snapshotRef = useRef(initialValue);
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      snapshotRef.current = initialValue;
      setDraft(initialValue);
    }

    wasOpenRef.current = open;
  }, [open, initialValue]);

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      internalInputRef.current = node;

      if (inputRef) {
        inputRef.current = node;
      }
    },
    [inputRef],
  );

  const focusInput = useCallback(() => {
    if (disabled) return;

    requestAnimationFrame(() => {
      internalInputRef.current?.focus({ preventScroll: true });
    });
  }, [disabled]);

  const closeDrawer = useCallback(() => {
    onOpenChange(false);

    window.setTimeout(() => {
      internalInputRef.current?.blur();
    }, 250);
  }, [onOpenChange]);

  const leave = useCallback(
    (commit: boolean) => {
      const trimmed = draft.trim();

      if (commit) {
        onCommit(trimmed);
      } else {
        setDraft(snapshotRef.current);
      }

      closeDrawer();
    },
    [closeDrawer, draft, onCommit],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }

      leave(false);
    },
    [leave, onOpenChange],
  );

  useEffect(() => {
    if (!open) return;

    focusInput();
  }, [open, focusInput]);

  useEffect(() => {
    if (!open) {
      setKeyboardOffset(0);
      setVisualViewportHeight(null);
      return;
    }

    const viewport = window.visualViewport;

    if (!viewport) return;

    const updateViewport = () => {
      const nextKeyboardOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );

      setKeyboardOffset(nextKeyboardOffset);
      setVisualViewportHeight(viewport.height);
    };

    updateViewport();

    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, [open]);

  const drawerStyle: DrawerKeyboardStyle = {
    bottom: `${keyboardOffset}px`,
    maxHeight: visualViewportHeight
      ? `calc(${visualViewportHeight}px - 16px)`
      : "calc(100dvh - 16px)",
    "--mobile-keyboard-offset": `${keyboardOffset}px`,
  };

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      repositionInputs={false}
    >
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}

      <DrawerContent
        bottomUnderlay={keyboardOffset > 0}
        bottomUnderlayHeight={keyboardOffset}
        style={drawerStyle}
        className={cn(MOBILE_DRAWER_SHELL_CLASS)}
      >
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
            ref={setInputRef}
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
