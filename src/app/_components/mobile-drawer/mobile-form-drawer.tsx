"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { Input } from "~/app/_components/input";
import { cn } from "~/lib/utils";

import {
  MOBILE_DRAWER_FIELD_INPUT_CLASS,
  MobileDrawerFieldView,
} from "./mobile-drawer-field-view";
import { MobileMenuDrawer } from "./mobile-menu-drawer";

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

/**
 * Standalone single-field mobile drawer (no view stack). Uses the same shell
 * and field chrome as drill-down menus.
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
  inputRef,
}: MobileFormDrawerProps) {
  const [draft, setDraft] = useState(initialValue);
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

  return (
    <MobileMenuDrawer
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
    >
      <MobileDrawerFieldView
        title={title}
        helperText={helperText}
        backLabel="Cancel"
        disabled={disabled}
        bodyClassName={contentClassName}
        onBack={() => leave(false)}
        onDone={() => leave(true)}
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
          className={MOBILE_DRAWER_FIELD_INPUT_CLASS}
          aria-label={inputLabel ?? title}
        />
      </MobileDrawerFieldView>
    </MobileMenuDrawer>
  );
}
