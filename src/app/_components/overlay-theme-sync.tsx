"use client";

import { useEffect } from "react";
import { refreshOverlayChrome } from "./overlay-backdrop";

/**
 * Sync safe-area chrome when Radix sets body[data-scroll-locked] on dialogs/sheets.
 *
 * The fixed sampler below only paints while a drawer sets data-drawer-chrome-sampler
 * (Drawer chromeSampler prop). Mobile nav and other overlays leave it hidden.
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
