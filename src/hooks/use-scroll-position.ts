import * as React from "react";

interface UseScrollPositionReturn<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T>;
  onScroll: (event: React.UIEvent<T>) => void;
  isScrolledFromTop: boolean;
  isScrolledFromBottom: boolean;
  scrollTop: number;
}

/**
 * Hook to track scroll position of an element.
 * Provides scroll state information and handlers.
 * 
 * @param deps - Optional dependency array to re-check scroll position when dependencies change
 * @returns Object containing ref, scroll handler, and scroll state
 */
export function useScrollPosition<T extends HTMLElement = HTMLElement>(
  deps?: React.DependencyList
): UseScrollPositionReturn<T> {
  const [isScrolledFromTop, setIsScrolledFromTop] = React.useState(false);
  const [isScrolledFromBottom, setIsScrolledFromBottom] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const ref = React.useRef<T>(null);

  // Update scroll state based on element's scroll position
  const updateScrollState = React.useCallback((element: T) => {
    const top = element.scrollTop;
    const isAtTop = top <= 0;
    const isAtBottom =
      top + element.clientHeight >= element.scrollHeight - 1;

    setScrollTop(top);
    setIsScrolledFromTop(!isAtTop);
    setIsScrolledFromBottom(!isAtBottom);
  }, []);

  // Handle scroll events
  const handleScroll = React.useCallback(
    (event: React.UIEvent<T>) => {
      updateScrollState(event.currentTarget);
    },
    [updateScrollState]
  );

  // Ensure scroll state is correct on mount and when dependencies change
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateScrollState(el);
  }, deps ? [updateScrollState, ...deps] : [updateScrollState]);

  return {
    ref,
    onScroll: handleScroll,
    isScrolledFromTop,
    isScrolledFromBottom,
    scrollTop,
  };
}

