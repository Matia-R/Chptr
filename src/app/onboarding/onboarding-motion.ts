type StepTransition = {
  duration: number;
  delay?: number;
  ease?: [number, number, number, number];
};

/** Cubic bezier shared by onboarding and signup step changes. */
const STEP_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const ONBOARDING_LOAD_INTRO = {
  y: 12,
  transition: {
    duration: 0.45,
    ease: STEP_EASE,
  } satisfies StepTransition,
};

/** Horizontal step change shared by onboarding and signup verification. */
export const STEP_SLIDE_PX = 24;

export const STEP_LEAVE = {
  duration: 0.18,
  ease: STEP_EASE,
} satisfies StepTransition;

export const STEP_ENTER = {
  duration: 0.28,
  delay: 0.16,
  ease: STEP_EASE,
} satisfies StepTransition;
