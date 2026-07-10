"use client";

import { useEffect } from "react";
import { refreshOverlayChrome } from "./overlay-backdrop";

/**
 * Sync safe-area chrome when Radix sets body[data-scroll-locked] on dialogs/sheets.
 *
 * iOS 26 Safari ignores theme-color and samples the nearest fixed/sticky background
 * at the viewport edge. The opaque sampler below is what actually tints the status bar
 * while overlays are open (see globals.css).
 */
export function OverlayThemeSync() {
  useEffect(() => {
    refreshOverlayChrome();

    const observer = new MutationObserver(() => {
      refreshOverlayChrome();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div data-overlay-chrome-sampler aria-hidden="true" />
  );
}
