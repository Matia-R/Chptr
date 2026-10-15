import type { ButtonHTMLAttributes } from "react";

import { buttonVariants } from "~/app/_components/button";
import { cn } from "~/lib/utils";

const copyButtonClassName =
  "absolute right-1.5 top-1.5 z-10 size-7 text-[hsl(var(--code-block-foreground))] opacity-40 hover:bg-transparent hover:opacity-80";

/** Static copy control. Safe to render while snapshotting published HTML. */
export function PublishedCodeCopyButtonMarkup({
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type={type}
      aria-label="Copy"
      {...props}
      className={cn(
        buttonVariants({
          variant: "ghost",
          size: "icon",
          className: cn(copyButtonClassName, className),
        }),
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-hidden
      >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
    </button>
  );
}
