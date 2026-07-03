"use client";

import { useEffect } from "react";
import { refreshOverlayChrome } from "./overlay-backdrop";

/** Sync safe-area chrome when Radix sets body[data-scroll-locked] on dialogs/sheets. */
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

  return null;
}
