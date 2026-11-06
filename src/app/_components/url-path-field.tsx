"use client";

import * as React from "react";

import { formControlClassName } from "~/lib/form-control-styles";
import { cn } from "~/lib/utils";

/**
 * Host prefix plus an editable path segment. The shell owns the border and
 * focus ring; the input is transparent so the prefix and value read as one field.
 */
const UrlPathField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & {
    prefix: string;
    /** Full prefix when the visible one is abbreviated. */
    prefixTitle?: string;
    trailing?: React.ReactNode;
  }
>(function UrlPathField(
  { prefix, prefixTitle, trailing, className, disabled, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md pl-3",
        trailing ? "pr-1" : "pr-3",
        formControlClassName,
        "focus-within:border-foreground/40 focus-within:outline-none focus-within:ring-1 focus-within:ring-foreground/10",
        disabled && "cursor-not-allowed opacity-50 hover:border-input",
      )}
    >
      <span
        className="shrink-0 select-none whitespace-nowrap font-normal text-base text-muted-foreground md:text-sm"
        title={prefixTitle}
        aria-hidden
        onMouseDown={(event) => {
          event.preventDefault();
          event.currentTarget.parentElement?.querySelector("input")?.focus();
        }}
      >
        {prefix}
      </span>
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent font-normal text-base text-foreground outline-none placeholder:text-muted-foreground/65 md:text-sm",
          className,
        )}
        {...props}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {trailing}
    </div>
  );
});

export { UrlPathField };
