"use client";

import { useLayoutEffect } from "react";

import { setSurfaceChrome } from "~/app/_components/overlay-backdrop";

/**
 * Keeps iOS Safari theme-color metas on bg-sidebar for the waitlist pages.
 *
 * No fixed edge strips — those sit on top of the page while scrolling. The
 * page root paints into the safe areas instead, so Safari samples the real
 * background as you scroll.
 */
export function SidebarSurfaceChrome() {
  useLayoutEffect(() => {
    setSurfaceChrome("sidebar");

    // Re-stamp the media-less theme-color when next-themes toggles `.dark`.
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.surfaceChrome === "sidebar") {
        setSurfaceChrome("sidebar");
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      setSurfaceChrome(null);
    };
  }, []);

  return null;
}
