export const ONBOARDING_LOAD_INTRO = {
  y: 12,
  transition: {
    duration: 0.45,
    ease: [0.22, 1, 0.36, 1] as const,
  },
};

/** Horizontal step change shared by onboarding and signup verification. */
export const STEP_SLIDE_PX = 24;

const STEP_EASE = [0.22, 1, 0.36, 1] as const;

export const STEP_LEAVE = {
  duration: 0.18,
  ease: STEP_EASE,
};

export const STEP_ENTER = {
  duration: 0.28,
  delay: 0.16,
  ease: STEP_EASE,
};
