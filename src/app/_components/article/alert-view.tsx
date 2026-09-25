import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const ALERTS = {
  warning: {
    box: "bg-yellow-50 dark:bg-yellow-900/30",
    icon: "text-yellow-500 dark:text-yellow-400",
    title: "text-yellow-700 dark:text-yellow-200",
    label: "Warning",
    Icon: CircleAlert,
  },
  error: {
    box: "bg-red-50 dark:bg-red-900/30",
    icon: "text-red-500 dark:text-red-400",
    title: "text-red-700 dark:text-red-200",
    label: "Error",
    Icon: CircleX,
  },
  info: {
    box: "bg-blue-50 dark:bg-blue-900/30",
    icon: "text-blue-500 dark:text-blue-400",
    title: "text-blue-700 dark:text-blue-200",
    label: "Info",
    Icon: CircleAlert,
  },
  success: {
    box: "bg-green-50 dark:bg-green-900/30",
    icon: "text-green-500 dark:text-green-400",
    title: "text-green-700 dark:text-green-200",
    label: "Success",
    Icon: CircleCheck,
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
  const Icon = alert.Icon;
  return (
    <div
      contentEditable={false}
      className={cn("my-4 w-full rounded-lg p-4", alert.box)}
      data-alert-type={type ?? "warning"}
    >
      <div className="mb-2 flex items-center gap-2" contentEditable={false}>
        <Icon className={cn("shrink-0", alert.icon)} size={24} aria-hidden />
        <div className={cn("font-semibold", alert.title)} contentEditable={false}>
          {alert.label}
        </div>
      </div>
      <div contentEditable={false}>{children}</div>
    </div>
  );
}
