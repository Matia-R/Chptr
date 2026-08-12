"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import type { SaveFeedbackState } from "~/hooks/use-save-feedback";
import { cn } from "~/lib/utils";

const CONTENT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

/**
 * Compact submission-button content: idle → saving → saved. Previous content
 * fades out, then the next state fades and slides in from the top as one unit.
 */
export function SaveFeedbackLabel({
  state,
  idleLabel = "Save",
  savingLabel = "Saving",
  savedLabel = "Saved",
  failedLabel,
  className,
}: {
  state: SaveFeedbackState;
  idleLabel?: string;
  savingLabel?: string;
  savedLabel?: string;
  /** Defaults to the idle label — most surfaces rely on a toast for errors. */
  failedLabel?: string;
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

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          // Key by state only so idle label swaps (e.g. section changes) update
          // instantly; animate only idle → saving → saved/failed.
          key={state}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={CONTENT_TRANSITION}
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          {state === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : state === "saved" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : null}
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </span>
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
