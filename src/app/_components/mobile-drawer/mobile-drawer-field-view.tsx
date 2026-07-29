"use client";

import {
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

import { cn } from "~/lib/utils";

import { MobileDrawerEditBody } from "./mobile-drawer-edit-body";
import { MobileDrawerNavHeader } from "./mobile-drawer-nav-header";
import { useMobileDrawerLeave } from "./use-mobile-drawer-leave";
import { focusMobileDrawerInput } from "./utils";

export const MOBILE_DRAWER_FIELD_INPUT_CLASS = cn(
  "h-10 w-full rounded-lg border border-sidebar-border/70 bg-background/50 px-3 text-base shadow-inner",
  "dark:border-white/[0.12] dark:bg-black/35",
  "focus-visible:ring-1 focus-visible:ring-ring",
);

export type MobileDrawerFieldViewProps = {
  title: string;
  children: ReactNode;
  onBack: () => void;
  onDone: () => void;
  helperText?: ReactNode;
  helperTextId?: string;
  /** Field status/error associated via `aria-describedby` (see EditBody). */
  description?: ReactNode;
  descriptionId?: string;
  backLabel?: string;
  doneLabel?: ReactNode;
  disabled?: boolean;
  doneDisabled?: boolean;
  doneClassName?: string;
  /** Autofocus the first text input/textarea on mount. Default true. */
  autoFocus?: boolean;
  /**
   * When true (default), Done also waits for keyboard dismiss before `onDone`.
   * Set false for async save flows that call `useMobileDrawerLeave()` after
   * a successful save.
   */
  dismissKeyboardOnDone?: boolean;
  /** Wrap content in a `<form>` that submits via Done. Default true. */
  asForm?: boolean;
  className?: string;
  bodyClassName?: string;
};

/**
 * Standard drill-down field screen: nav chrome, padded body, autofocus, and
 * keyboard-safe Back (and optionally Done) navigation.
 */
export function MobileDrawerFieldView({
  title,
  children,
  onBack,
  onDone,
  helperText,
  helperTextId,
  description,
  descriptionId,
  backLabel = "Back",
  doneLabel = "Done",
  disabled = false,
  doneDisabled,
  doneClassName,
  autoFocus = true,
  dismissKeyboardOnDone = true,
  asForm = true,
  className,
  bodyClassName,
}: MobileDrawerFieldViewProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const leave = useMobileDrawerLeave();

  useEffect(() => {
    if (!autoFocus) return;

    const frame = requestAnimationFrame(() => {
      const input = rootRef.current?.querySelector("input, textarea");
      if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement
      ) {
        focusMobileDrawerInput(input);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  const handleBack = () => {
    leave(onBack);
  };

  const handleDone = () => {
    if (dismissKeyboardOnDone) {
      leave(onDone);
      return;
    }
    onDone();
  };

  const body = (
    <>
      <MobileDrawerNavHeader
        title={title}
        backLabel={backLabel}
        doneLabel={doneLabel}
        disabled={disabled}
        doneDisabled={doneDisabled}
        doneClassName={doneClassName}
        onBack={handleBack}
        onDone={handleDone}
      />
      <MobileDrawerEditBody
        helperText={helperText}
        helperTextId={helperTextId}
        description={description}
        descriptionId={descriptionId}
        className={bodyClassName}
      >
        {children}
      </MobileDrawerEditBody>
    </>
  );

  if (asForm) {
    return (
      <form
        ref={(node) => {
          rootRef.current = node;
        }}
        className={className}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          handleDone();
        }}
      >
        {body}
      </form>
    );
  }

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
      }}
      className={className}
    >
      {body}
    </div>
  );
}
