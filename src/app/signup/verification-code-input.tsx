"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

import { formControlClassName } from "~/lib/form-control-styles";
import { normalizeVerificationCode } from "~/lib/pending-signup";
import { cn } from "~/lib/utils";

const SLOT_COUNT = 6;

export function VerificationCodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  errorId,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
  autoFocus?: boolean;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!autoFocus) return;
    inputs.current[0]?.focus();
  }, [autoFocus]);

  function focusAt(index: number) {
    const slot = Math.min(Math.max(index, 0), SLOT_COUNT - 1);
    inputs.current[slot]?.focus();
  }

  function apply(next: string, focusIndex: number) {
    const code = normalizeVerificationCode(next);
    onChange(code);
    focusAt(code.length === 0 ? 0 : Math.min(focusIndex, SLOT_COUNT - 1));
  }

  function onSlotChange(index: number, raw: string) {
    const digits = normalizeVerificationCode(raw);
    if (digits.length > 1) {
      apply(digits, Math.max(digits.length - 1, 0));
      return;
    }
    const chars = value.split("");
    chars[index] = digits;
    const next = normalizeVerificationCode(chars.join(""));
    onChange(next);
    if (digits && index < SLOT_COUNT - 1) focusAt(index + 1);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (event.key === "ArrowRight" && index < SLOT_COUNT - 1) {
      event.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (event.key !== "Backspace") return;

    event.preventDefault();
    if (value[index]) {
      const chars = value.split("");
      chars[index] = "";
      onChange(normalizeVerificationCode(chars.join("")));
      return;
    }
    if (index === 0) return;
    const chars = value.split("");
    chars[index - 1] = "";
    onChange(normalizeVerificationCode(chars.join("")));
    focusAt(index - 1);
  }

  return (
    <div
      role="group"
      aria-label="Verification code"
      aria-describedby={errorId}
      className="grid grid-cols-6 gap-2"
    >
      {Array.from({ length: SLOT_COUNT }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          value={value[index] ?? ""}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={`Digit ${index + 1} of ${SLOT_COUNT}`}
          aria-invalid={invalid || undefined}
          className={cn(
            formControlClassName,
            "h-12 w-full min-w-0 rounded-md text-center text-base font-medium tabular-nums",
            invalid && "border-destructive focus-visible:border-destructive",
          )}
          onChange={(event) => onSlotChange(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          onPaste={(event) => {
            event.preventDefault();
            const text = normalizeVerificationCode(
              event.clipboardData.getData("text"),
            );
            apply(text, Math.max(text.length - 1, 0));
          }}
        />
      ))}
    </div>
  );
}
