"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/** Rounded grouped container (Notion / iOS-style settings sheet). */
export function MobileActionGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px]",
        "border border-sidebar-border/70 bg-sidebar-accent/45 dark:border-white/10 dark:bg-[hsl(0_0%_22%_/_.95)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type RowBase = {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
};

export function MobileActionButtonRow({
  icon: Icon,
  label,
  destructive,
  disabled,
  trailing,
  iconClassName,
  onClick,
  onPointerDown,
}: RowBase & {
  iconClassName?: string;
  onClick: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "border-t border-sidebar-border/55 first:border-t-0 dark:border-white/[0.08]",
        "active:bg-sidebar-accent dark:active:bg-white/[0.06]",
        "disabled:pointer-events-none disabled:opacity-45",
        destructive
          ? "text-[hsl(var(--destructive))]"
          : "text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-[22px] shrink-0 stroke-[1.35]",
          destructive && "text-[hsl(var(--destructive))]",
          iconClassName,
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 text-[17px] font-normal leading-snug tracking-tight">
        {label}
      </span>
      {trailing ? (
        <span className="shrink-0 text-muted-foreground">{trailing}</span>
      ) : null}
    </button>
  );
}

export function MobileActionLinkRow({
  icon: Icon,
  label,
  href,
  disabled,
  trailing,
}: RowBase & {
  href: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "border-t border-sidebar-border/55 first:border-t-0 dark:border-white/[0.08]",
        "active:bg-sidebar-accent dark:active:bg-white/[0.06]",
        "text-sidebar-foreground",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <Icon className="size-[22px] shrink-0 stroke-[1.35]" aria-hidden />
      <span className="min-w-0 flex-1 text-[17px] font-normal leading-snug tracking-tight">
        {label}
      </span>
      {trailing ? (
        <span className="shrink-0 text-muted-foreground">{trailing}</span>
      ) : null}
    </Link>
  );
}

/**
 * List row that matches {@link MobileActionButtonRow} styling; tap toggles
 * expanded content below (e.g. slug editor).
 */
export function MobileActionExpandingRow({
  icon: Icon,
  label,
  summary,
  expanded,
  onToggle,
  disabled,
  children,
}: {
  icon: LucideIcon;
  label: string;
  summary?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-t border-sidebar-border/55 first:border-t-0 dark:border-white/[0.08]",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          "flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
          "active:bg-sidebar-accent dark:active:bg-white/[0.06]",
          "disabled:pointer-events-none disabled:opacity-45",
          "text-sidebar-foreground",
        )}
      >
        <Icon
          className="size-[22px] shrink-0 stroke-[1.35]"
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-[17px] font-normal leading-snug tracking-tight">
          {label}
        </span>
        {summary != null ? (
          <span className="min-w-0 max-w-[45%] shrink truncate text-right text-[15px] text-muted-foreground">
            {summary}
          </span>
        ) : null}
        <ChevronRight
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          className="border-t border-sidebar-border/55 bg-sidebar-accent/30 px-3 py-3 dark:border-white/[0.08] dark:bg-black/20"
          role="region"
          aria-label={label}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Full-width cell inside a group (e.g. slug field). */
export function MobileActionInsetCell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-t border-sidebar-border/55 px-3 py-3 first:border-t-0 dark:border-white/[0.08]",
        className,
      )}
    >
      {children}
    </div>
  );
}
