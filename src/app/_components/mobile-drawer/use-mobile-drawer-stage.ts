"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  MOBILE_DRAWER_KEYBOARD_CLEARANCE_PX,
} from "./constants";
import {
  applyMobileDrawerKeyboardInset,
  resetMobileDrawerKeyboardStyles,
} from "./utils";

export type UseMobileDrawerStageOptions<T extends string> = {
  view: T;
  setView: (view: T) => void;
  mainView: T;
  /**
   * View(s) that open the software keyboard. Pass a stable array reference when
   * more than one sub-screen has inputs.
   */
  keyboardView: T | readonly T[] | null;
  /**
   * Optional floor for keyboard-view stage height. Default 0 — size from
   * measured content (correct for single-field drills and URL editors alike).
   */
  keyboardMinContentPx?: number;
  keyboardClearancePx?: number;
  /**
   * Grow the Vaul shell to the visual viewport while the keyboard is open.
   * Default false — use `MobileMenuDrawer` (keyboard offset) instead. The inset
   * fills the screen when combined with offset.
   */
  keyboardShellInset?: boolean;
  /** Re-measure the main view when these change. */
  measureDeps?: readonly unknown[];
};

export function useMobileDrawerStage<T extends string>({
  view,
  setView,
  mainView,
  keyboardView,
  keyboardMinContentPx = 0,
  keyboardClearancePx = MOBILE_DRAWER_KEYBOARD_CLEARANCE_PX,
  keyboardShellInset = false,
  measureDeps = [],
}: UseMobileDrawerStageOptions<T>) {
  const [direction, setDirection] = useState(1);
  const [stageMinHeight, setStageMinHeight] = useState<number>();
  const [mainStageHeight, setMainStageHeight] = useState<number>();
  const [intermediateStageHeight, setIntermediateStageHeight] =
    useState<number>();
  const stageRef = useRef<HTMLDivElement>(null);
  const mainMeasureRef = useRef<HTMLDivElement | null>(null);
  const intermediateMeasureRef = useRef<HTMLDivElement | null>(null);
  const keyboardMeasureRef = useRef<HTMLDivElement | null>(null);
  /** Prefer this height over the first post-return measure (avoids overshoot). */
  const restoredIntermediateHeightRef = useRef<number | null>(null);

  const isKeyboardView = useCallback(
    (candidate: T) => {
      if (keyboardView == null) return false;
      return typeof keyboardView === "string"
        ? keyboardView === candidate
        : keyboardView.includes(candidate);
    },
    [keyboardView],
  );

  const goToView = useCallback(
    (next: T, nextDirection: number) => {
      setDirection(nextDirection);
      setView(next);
    },
    [setView],
  );

  const measureMainStage = useCallback(() => {
    // Only measure the main view node. Falling back to stageRef poisons
    // mainStageHeight when called from an intermediate screen (Profile),
    // because the stage is already sized to that taller view.
    const node = mainMeasureRef.current;
    if (!node) return;
    const height = node.getBoundingClientRect().height;
    if (height > 0) {
      setMainStageHeight(height);
      if (view === mainView) {
        setStageMinHeight(height);
      }
    }
  }, [mainView, view]);

  const expandStageForKeyboardView = useCallback(() => {
    // When min content is 0, skip the predictive floor and wait for measure so
    // we don't collapse to clearance-only, then bounce back up.
    if (keyboardMinContentPx <= 0) return;
    setStageMinHeight(keyboardMinContentPx + keyboardClearancePx);
  }, [keyboardClearancePx, keyboardMinContentPx]);

  const returnToMainView = useCallback(() => {
    resetMobileDrawerKeyboardStyles();
    if (mainStageHeight != null) {
      setStageMinHeight(mainStageHeight);
    }
    setDirection(-1);
    setView(mainView);
  }, [mainStageHeight, mainView, setView]);

  /**
   * Back from a keyboard/field screen to an intermediate list (e.g. Profile),
   * restoring that list's measured height when we have it.
   */
  const returnToView = useCallback(
    (next: T) => {
      if (next === mainView) {
        returnToMainView();
        return;
      }

      resetMobileDrawerKeyboardStyles();
      if (intermediateStageHeight != null) {
        restoredIntermediateHeightRef.current = intermediateStageHeight;
        setStageMinHeight(intermediateStageHeight);
        // Only suppress inflated remount measures for a couple frames.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            restoredIntermediateHeightRef.current = null;
          });
        });
      }
      setDirection(-1);
      setView(next);
    },
    [intermediateStageHeight, mainView, returnToMainView, setView],
  );

  const readContentHeight = (node: HTMLDivElement) => {
    // Sum direct children so a stretched absolute wrapper can't inflate height
    // (common when remounting Profile after a shorter field editor).
    let contentH = 0;
    for (const child of Array.from(node.children)) {
      if (child instanceof HTMLElement) {
        contentH += child.offsetHeight;
      }
    }
    return contentH > 0 ? contentH : node.offsetHeight;
  };

  const applyIntermediateHeight = useCallback((node: HTMLDivElement) => {
    const height = readContentHeight(node);
    if (height <= 0) return;

    const restored = restoredIntermediateHeightRef.current;
    if (restored != null) {
      // Ignore one-frame inflated measures after returning from a field editor.
      if (height > restored + 8) {
        setStageMinHeight(restored);
        return;
      }
      restoredIntermediateHeightRef.current = null;
    }

    setIntermediateStageHeight(height);
    setStageMinHeight(height);
  }, []);

  const applyKeyboardHeight = useCallback(
    (node: HTMLDivElement) => {
      const editH = readContentHeight(node);
      if (editH <= 0) return;
      setStageMinHeight(
        Math.max(editH, keyboardMinContentPx) + keyboardClearancePx,
      );
    },
    [keyboardClearancePx, keyboardMinContentPx],
  );

  const mainRefCallback = useCallback((node: HTMLDivElement | null) => {
    mainMeasureRef.current = node;
  }, []);

  const keyboardRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      keyboardMeasureRef.current = node;
      if (node) applyKeyboardHeight(node);
    },
    [applyKeyboardHeight],
  );

  const intermediateRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      intermediateMeasureRef.current = node;
      if (node) applyIntermediateHeight(node);
    },
    [applyIntermediateHeight],
  );

  const getMotionRef = useCallback(
    (currentView: T) => {
      if (currentView === mainView) return mainRefCallback;
      if (isKeyboardView(currentView)) return keyboardRefCallback;
      return intermediateRefCallback;
    },
    [
      intermediateRefCallback,
      isKeyboardView,
      keyboardRefCallback,
      mainRefCallback,
      mainView,
    ],
  );

  useLayoutEffect(() => {
    if (view !== mainView) return;
    resetMobileDrawerKeyboardStyles();
    measureMainStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mainView, measureMainStage, ...measureDeps]);

  // Keep intermediate stage height in sync while Profile (etc.) is showing —
  // avatar load / content changes can grow past the first measure.
  useLayoutEffect(() => {
    if (view === mainView || isKeyboardView(view)) return;
    const node = intermediateMeasureRef.current;
    if (!node) return;

    applyIntermediateHeight(node);

    const observer = new ResizeObserver(() => {
      applyIntermediateHeight(node);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mainView, isKeyboardView, applyIntermediateHeight, ...measureDeps]);

  useLayoutEffect(() => {
    if (!isKeyboardView(view)) return;

    resetMobileDrawerKeyboardStyles();

    const node = keyboardMeasureRef.current;
    if (!node) return;

    applyKeyboardHeight(node);

    const observer = new ResizeObserver(() => {
      applyKeyboardHeight(node);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [view, isKeyboardView, applyKeyboardHeight]);

  useEffect(() => {
    if (!isKeyboardView(view) || !keyboardShellInset) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const onViewportChange = () => {
      applyMobileDrawerKeyboardInset();
    };

    viewport.addEventListener("resize", onViewportChange);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(onViewportChange);
    });

    return () => {
      viewport.removeEventListener("resize", onViewportChange);
      cancelAnimationFrame(frame);
    };
  }, [isKeyboardView, keyboardShellInset, view]);

  return {
    direction,
    stageMinHeight,
    stageIsMeasured: stageMinHeight !== undefined,
    stageRef,
    mainMeasureRef,
    intermediateMeasureRef,
    keyboardMeasureRef,
    mainStageHeight,
    intermediateStageHeight,
    goToView,
    measureMainStage,
    expandStageForKeyboardView,
    returnToMainView,
    returnToView,
    getMotionRef,
    setDirection,
  };
}
