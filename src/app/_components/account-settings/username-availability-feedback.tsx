"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { cn } from "~/lib/utils";

import type { UsernameAvailabilityStatus } from "./use-username-availability";

const FADE_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

/**
 * Inline username availability feedback. Fade-only transitions match the save
 * button's timing, without the slide.
 */
export function UsernameAvailabilityFeedback({
  status,
  className,
  id,
}: {
  status: UsernameAvailabilityStatus;
  className?: string;
  id?: string;
}) {
  if (status === "idle") return null;

  return (
    <span
      id={id}
      className={cn(
        "inline-flex min-h-[1.25rem] items-center overflow-hidden",
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          className={cn(
            "inline-flex items-center gap-1.5 text-[0.8rem]",
            status === "taken" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status === "checking" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Checking availability
            </>
          ) : status === "available" ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              Username is available
            </>
          ) : (
            "Username is taken"
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
