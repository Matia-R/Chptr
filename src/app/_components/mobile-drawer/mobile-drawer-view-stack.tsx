"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode, Ref, RefObject } from "react";

import { cn } from "~/lib/utils";

import {
  MOBILE_DRAWER_STAGE_HEIGHT_TRANSITION_CLASS,
  mobileDrawerViewTransition,
  mobileDrawerViewVariants,
} from "./constants";
import {
  applyMobileDrawerKeyboardInset,
  focusMobileDrawerInput,
} from "./utils";

export type MobileDrawerViewStackProps<T extends string> = {
  view: T;
  direction: number;
  stageMinHeight?: number;
  stageIsMeasured: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  getMotionRef: (view: T) => RefObject<HTMLDivElement | null> | undefined;
  /** When this view finishes entering, focus the input with this id. */
  focusInputIdOnEnter?: Partial<Record<T, string>>;
  renderView: (view: T) => ReactNode;
  className?: string;
};

/**
 * Animated stack for nested mobile drawer views (slide + fade, fixed stage height).
 */
export function MobileDrawerViewStack<T extends string>({
  view,
  direction,
  stageMinHeight,
  stageIsMeasured,
  stageRef,
  getMotionRef,
  focusInputIdOnEnter,
  renderView,
  className,
}: MobileDrawerViewStackProps<T>) {
  const focusId = focusInputIdOnEnter?.[view];

  return (
    <div className={cn("bg-sidebar text-sidebar-foreground", className)}>
      <div
        ref={stageRef as Ref<HTMLDivElement>}
        className={cn(
          "relative w-full overflow-hidden",
          stageIsMeasured && MOBILE_DRAWER_STAGE_HEIGHT_TRANSITION_CLASS,
        )}
        style={stageIsMeasured ? { minHeight: stageMinHeight } : undefined}
      >
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={view}
            ref={getMotionRef(view) as Ref<HTMLDivElement>}
            custom={direction}
            variants={mobileDrawerViewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={mobileDrawerViewTransition}
            className={cn(
              "w-full bg-sidebar",
              stageIsMeasured && "absolute inset-x-0 top-0",
            )}
            onAnimationComplete={(definition) => {
              if (definition !== "center" || !focusId) return;
              const input = document.getElementById(focusId);
              if (!(input instanceof HTMLInputElement)) return;
              focusMobileDrawerInput(input);
              window.setTimeout(() => {
                applyMobileDrawerKeyboardInset();
              }, 50);
            }}
          >
            {renderView(view)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
