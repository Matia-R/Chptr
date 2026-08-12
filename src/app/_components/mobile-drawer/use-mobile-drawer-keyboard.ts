"use client";

import { useEffect, useState, type CSSProperties } from "react";

export type DrawerKeyboardStyle = CSSProperties & {
  "--mobile-keyboard-offset"?: string;
};

/**
 * Keeps a bottom drawer pinned above the software keyboard, and caps its height
 * to the visual viewport so long content stays reachable while typing.
 */
export function useMobileDrawerKeyboardOffset(open: boolean) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!open) {
      setKeyboardOffset(0);
      setVisualViewportHeight(null);
      return;
    }

    const viewport = window.visualViewport;

    if (!viewport) return;

    const updateViewport = () => {
      const nextKeyboardOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );

      setKeyboardOffset(nextKeyboardOffset);
      setVisualViewportHeight(viewport.height);
    };

    updateViewport();

    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, [open]);

  const drawerStyle: DrawerKeyboardStyle = {
    bottom: `${keyboardOffset}px`,
    maxHeight: visualViewportHeight
      ? `calc(${visualViewportHeight}px - 16px)`
      : "calc(100dvh - 16px)",
    "--mobile-keyboard-offset": `${keyboardOffset}px`,
  };

  return { keyboardOffset, drawerStyle };
}
