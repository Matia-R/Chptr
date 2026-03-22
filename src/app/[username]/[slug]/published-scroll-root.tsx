"use client";

import { useLayoutEffect } from "react";

const CLASS = "published-page-scroll";

/**
 * Root layout uses `position: fixed` on html/body for the app shell. Published
 * pages are standalone and need normal document scrolling.
 */
export function PublishedScrollRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(CLASS);
    return () => {
      root.classList.remove(CLASS);
    };
  }, []);

  return <>{children}</>;
}
