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
const DEFAULT_LABELS = {
  checking: "Checking availability",
  available: "Handle is available",
  taken: "Handle is taken",
  reserved: "Handle is reserved",
  error: "Couldn't check availability",
};

function AvailabilityCopy({
  status,
  copy,
}: {
  status: Exclude<UsernameAvailabilityStatus, "idle">;
  copy: typeof DEFAULT_LABELS;
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 text-[0.8rem]",
    status === "taken" || status === "reserved"
      ? "text-destructive"
      : "text-muted-foreground",
  );

  if (status === "checking") {
    return (
      <span className={className}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {copy.checking}
      </span>
    );
  }

  if (status === "available") {
    return (
      <span className={className}>
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        {copy.available}
      </span>
    );
  }

  if (status === "error") {
    return <span className={className}>{copy.error}</span>;
  }

  return (
    <span className={className}>
      {status === "reserved" ? copy.reserved : copy.taken}
    </span>
  );
}

export function UsernameAvailabilityFeedback({
  status,
  className,
  id,
  labels,
  animate = true,
}: {
  status: UsernameAvailabilityStatus;
  className?: string;
  id?: string;
  /** Overrides the default account-settings copy. */
  labels?: Partial<typeof DEFAULT_LABELS>;
  /** Crossfade between states. Off when a second fade reads as a double render. */
  animate?: boolean;
}) {
  const copy = { ...DEFAULT_LABELS, ...labels };
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
      {animate ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
            className="inline-flex"
          >
            <AvailabilityCopy status={status} copy={copy} />
          </motion.span>
        </AnimatePresence>
      ) : (
        <AvailabilityCopy status={status} copy={copy} />
      )}
    </span>
  );
}
