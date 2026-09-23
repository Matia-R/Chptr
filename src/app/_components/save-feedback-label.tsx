"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { SaveFeedbackState } from "~/hooks/use-save-feedback";
import { cn } from "~/lib/utils";

export const SAVE_FEEDBACK_CONTENT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

/**
 * Shared idle → pending → success swap. Previous content fades out, then the
 * next state fades and slides in from the top as one unit.
 */
export function SaveFeedbackContent({
  motionKey,
  className,
  contentClassName,
  children,
}: {
  motionKey: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={motionKey}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
            contentClassName,
          )}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Compact submission-button content: idle → saving → saved. `layout="row"`
 * is the full-width leading-icon variant used by mobile action rows.
 */
export function SaveFeedbackLabel({
  state,
  idleLabel = "Save",
  savingLabel = "Saving",
  savedLabel = "Saved",
  failedLabel,
  idleIcon: IdleIcon,
  failedIcon: FailedIcon,
  layout = "button",
  animateLabelChanges = false,
  className,
}: {
  state: SaveFeedbackState;
  idleLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
  /** Defaults to the idle label — most surfaces rely on a toast for errors. */
  failedLabel?: string;
  /** Resting icon. Omitted on compact buttons that are label-only until pending. */
  idleIcon?: LucideIcon;
  failedIcon?: LucideIcon;
  layout?: "button" | "row";
  /**
   * Also transition when the idle copy changes (Published → Update).
   * Leave off when the idle label swaps for an unrelated reason, such as
   * changing settings sections.
   */
  animateLabelChanges?: boolean;
  className?: string;
}) {
  const label =
    state === "saving"
      ? savingLabel
      : state === "saved"
        ? savedLabel
        : state === "failed"
          ? (failedLabel ?? idleLabel)
          : idleLabel;

  const iconClassName =
    layout === "row" ? "size-[22px] shrink-0 stroke-[1.35]" : "h-4 w-4";

  const icon =
    state === "saving" ? (
      <Loader2 className={cn(iconClassName, "animate-spin")} aria-hidden />
    ) : state === "saved" ? (
      <Check className={iconClassName} aria-hidden />
    ) : state === "failed" && FailedIcon ? (
      <FailedIcon
        className={cn(iconClassName, "text-destructive")}
        aria-hidden
      />
    ) : state === "idle" && IdleIcon ? (
      <IdleIcon className={iconClassName} aria-hidden />
    ) : null;

  return (
    <SaveFeedbackContent
      // Key by state only so idle label swaps (e.g. section changes) update
      // instantly; animate only idle → saving → saved/failed unless the
      // caller opts into label changes.
      motionKey={animateLabelChanges ? `${state}:${label}` : state}
      className={cn(layout === "row" && "w-full justify-start", className)}
      contentClassName={
        layout === "row" ? "w-full justify-start gap-3" : undefined
      }
    >
      {icon}
      <span
        className={
          layout === "row"
            ? "min-w-0 flex-1 text-left text-[17px] font-normal leading-snug tracking-tight"
            : undefined
        }
      >
        {label}
      </span>
    </SaveFeedbackContent>
  );
}

/** Maps publish-store feedback onto the shared submission-button states. */
export function publishFeedbackToSaveState(
  publishFeedback: "idle" | "publishing" | "published" | "failed",
): SaveFeedbackState {
  if (publishFeedback === "publishing") return "saving";
  if (publishFeedback === "published") return "saved";
  if (publishFeedback === "failed") return "failed";
  return "idle";
}
