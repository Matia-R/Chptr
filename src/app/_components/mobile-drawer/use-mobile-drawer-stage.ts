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
  keyboardView: T | null;
  /** Minimum content height when expanding for the keyboard view. */
  keyboardMinContentPx?: number;
  keyboardClearancePx?: number;
  /** Re-measure the main view when these change. */
  measureDeps?: readonly unknown[];
};

export function useMobileDrawerStage<T extends string>({
  view,
  setView,
  mainView,
  keyboardView,
  keyboardMinContentPx = 268,
  keyboardClearancePx = MOBILE_DRAWER_KEYBOARD_CLEARANCE_PX,
  measureDeps = [],
}: UseMobileDrawerStageOptions<T>) {
  const [direction, setDirection] = useState(1);
  const [stageMinHeight, setStageMinHeight] = useState<number>();
  const [mainStageHeight, setMainStageHeight] = useState<number>();
  const stageRef = useRef<HTMLDivElement>(null);
  const mainMeasureRef = useRef<HTMLDivElement>(null);
  const keyboardMeasureRef = useRef<HTMLDivElement>(null);

  const goToView = useCallback(
    (next: T, nextDirection: number) => {
      setDirection(nextDirection);
      setView(next);
    },
    [setView],
  );

  const measureMainStage = useCallback(() => {
    const node = mainMeasureRef.current ?? stageRef.current;
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
    const mainH =
      mainStageHeight ??
      mainMeasureRef.current?.getBoundingClientRect().height ??
      0;
    const target =
      Math.max(mainH, keyboardMinContentPx) + keyboardClearancePx;
    setStageMinHeight(target);
  }, [keyboardClearancePx, keyboardMinContentPx, mainStageHeight]);

  const returnToMainView = useCallback(() => {
    if (mainStageHeight != null) {
      setStageMinHeight(mainStageHeight);
    }
    setDirection(-1);
    setView(mainView);
  }, [mainStageHeight, mainView, setView]);

  const getMotionRef = useCallback(
    (currentView: T) => {
      if (currentView === mainView) return mainMeasureRef;
      if (keyboardView != null && currentView === keyboardView) {
        return keyboardMeasureRef;
      }
      return undefined;
    },
    [keyboardView, mainView],
  );

  useLayoutEffect(() => {
    if (view !== mainView) return;
    resetMobileDrawerKeyboardStyles();
    measureMainStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mainView, measureMainStage, ...measureDeps]);

  useLayoutEffect(() => {
    if (keyboardView == null || view !== keyboardView) return;
    if (!keyboardMeasureRef.current) return;
    const editH = keyboardMeasureRef.current.getBoundingClientRect().height;
    if (editH <= 0) return;
    const target =
      Math.max(mainStageHeight ?? 0, editH) + keyboardClearancePx;
    setStageMinHeight((prev) => Math.max(prev ?? 0, target));
  }, [view, keyboardView, mainStageHeight, keyboardClearancePx]);

  useEffect(() => {
    if (keyboardView == null || view !== keyboardView) return;

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
  }, [keyboardView, view]);

  return {
    direction,
    stageMinHeight,
    stageIsMeasured: stageMinHeight !== undefined,
    stageRef,
    mainMeasureRef,
    keyboardMeasureRef,
    mainStageHeight,
    goToView,
    measureMainStage,
    expandStageForKeyboardView,
    returnToMainView,
    getMotionRef,
    setDirection,
  };
}
