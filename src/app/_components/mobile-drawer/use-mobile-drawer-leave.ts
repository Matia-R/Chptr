"use client";

import { useCallback } from "react";

import {
  resetMobileDrawerKeyboardStyles,
  waitForMobileDrawerKeyboardDismiss,
} from "./utils";

/**
 * Blur the focused field, wait for the software keyboard to dismiss, then run
 * `after`. Use for Back / Done navigation out of keyboard screens so the
 * previous view doesn't resize against a shifting visual viewport.
 */
export function useMobileDrawerLeave() {
  return useCallback((after: () => void) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }

    waitForMobileDrawerKeyboardDismiss(() => {
      resetMobileDrawerKeyboardStyles();
      after();
    });
  }, []);
}
