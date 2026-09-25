import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

function AlertIcon({
  kind,
  className,
}: {
  kind: "alert" | "x" | "check";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-6 shrink-0", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      {kind === "alert" ? (
        <>
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </>
      ) : null}
      {kind === "x" ? (
        <>
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </>
      ) : null}
      {kind === "check" ? <path d="m9 12 2 2 4-4" /> : null}
    </svg>
  );
}

const ALERTS = {
  warning: {
    box: "bg-yellow-50 dark:bg-yellow-900/30",
    icon: "text-yellow-500 dark:text-yellow-400",
    title: "text-yellow-700 dark:text-yellow-200",
    label: "Warning",
    kind: "alert",
  },
  error: {
    box: "bg-red-50 dark:bg-red-900/30",
    icon: "text-red-500 dark:text-red-400",
    title: "text-red-700 dark:text-red-200",
    label: "Error",
    kind: "x",
  },
  info: {
    box: "bg-blue-50 dark:bg-blue-900/30",
    icon: "text-blue-500 dark:text-blue-400",
    title: "text-blue-700 dark:text-blue-200",
    label: "Info",
    kind: "alert",
  },
  success: {
    box: "bg-green-50 dark:bg-green-900/30",
    icon: "text-green-500 dark:text-green-400",
    title: "text-green-700 dark:text-green-200",
    label: "Success",
    kind: "check",
  },
} as const;

type AlertType = keyof typeof ALERTS;

function alertFor(type: string | undefined) {
  if (type && type in ALERTS) return ALERTS[type as AlertType];
  return ALERTS.warning;
}

/**
 * The alert's visible body. The editor wraps this with BlockNote editing
 * behavior; the published page wraps it with article content.
 */
export function AlertView({
  type,
  children,
}: {
  type: string | undefined;
  children: ReactNode;
}) {
  const alert = alertFor(type);
  return (
    <div
      contentEditable={false}
      className={cn("my-4 w-full rounded-lg p-4", alert.box)}
      data-alert-type={type ?? "warning"}
    >
      <div className="mb-2 flex items-center gap-2" contentEditable={false}>
        <AlertIcon kind={alert.kind} className={alert.icon} />
        <div className={cn("font-semibold", alert.title)} contentEditable={false}>
          {alert.label}
        </div>
      </div>
      <div contentEditable={false}>{children}</div>
    </div>
  );
}
