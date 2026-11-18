"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { ONBOARDING_LOAD_INTRO } from "~/app/onboarding/onboarding-motion";

/**
 * Same fade-up on first paint as onboarding's load intro.
 */
export function LandingIntro({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: ONBOARDING_LOAD_INTRO.y }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              ...ONBOARDING_LOAD_INTRO.transition,
              // ~32% slower than onboarding's load intro (20%, then +10%).
              duration: ONBOARDING_LOAD_INTRO.transition.duration * 1.32,
            }
      }
    >
      {children}
    </motion.div>
  );
}
