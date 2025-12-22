"use client";

import * as React from "react";
import { useScrollPosition } from "~/hooks/use-scroll-position";
import { useScroll } from "./scroll-context";

interface DocumentLayoutWrapperProps {
  children: React.ReactNode;
}

export function DocumentLayoutWrapper({
  children,
}: DocumentLayoutWrapperProps) {
  const {
    ref: mainRef,
    onScroll: onScrollEvent,
    isScrolledFromTop,
  } = useScrollPosition<HTMLElement>();
  const { setIsScrolled } = useScroll();

  React.useEffect(() => {
    setIsScrolled(isScrolledFromTop);
  }, [isScrolledFromTop, setIsScrolled]);

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      onScrollEvent(event);
    },
    [onScrollEvent],
  );

  return (
    <div className="flex h-screen min-w-0 flex-col pt-12">
      <main
        ref={mainRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div className="h-full md:pb-8 md:pl-8 md:pr-4 md:pt-8 lg:pb-12 lg:pl-12 lg:pr-4 lg:pt-12">
          <div className="mx-auto h-full min-w-0 max-w-[720px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
