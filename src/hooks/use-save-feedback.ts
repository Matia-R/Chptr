"use client";

import * as React from "react";

export type SaveFeedbackState = "idle" | "saving" | "saved" | "failed";

/** Keeps the spinner on screen long enough to read even when the save is instant. */
export const SAVE_FEEDBACK_MIN_SAVING_MS = 500;

/** How long success/failure lingers before returning to idle. */
export const SAVE_FEEDBACK_RESULT_MS = 1200;

/** Lets a surface close/navigate away while success is still on screen. */
export const SAVE_FEEDBACK_SETTLE_MS = 700;

/**
 * Drives a submission control through saving → saved → idle on every submit,
 * regardless of how fast the round trip is.
 */
export function useSaveFeedback() {
  const [state, setState] = React.useState<SaveFeedbackState>("idle");
  const [inFlight, setInFlight] = React.useState(false);
  const startedAtRef = React.useRef(0);
  const timeoutsRef = React.useRef<number[]>([]);

  const clearTimers = React.useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  React.useEffect(() => clearTimers, [clearTimers]);

  const later = React.useCallback((fn: () => void, delay: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, delay));
  }, []);

  const start = React.useCallback(() => {
    clearTimers();
    startedAtRef.current = Date.now();
    setInFlight(true);
    setState("saving");
  }, [clearTimers]);

  /**
   * Holds the spinner for the remainder of its minimum duration, shows the
   * result, then returns to idle.
   */
  const settle = React.useCallback(
    async (result: "saved" | "failed") => {
      clearTimers();

      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < SAVE_FEEDBACK_MIN_SAVING_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, SAVE_FEEDBACK_MIN_SAVING_MS - elapsed),
        );
      }

      setInFlight(false);
      setState(result);
      later(() => setState("idle"), SAVE_FEEDBACK_RESULT_MS);
    },
    [clearTimers, later],
  );

  return {
    state,
    /** True from `start` until `settle` begins showing a result. */
    inFlight,
    start,
    settle,
    runAfterResult: later,
  };
}
