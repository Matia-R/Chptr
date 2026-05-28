export const mobileDrawerViewTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const MOBILE_DRAWER_STAGE_HEIGHT_TRANSITION_CLASS =
  "transition-[min-height] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

export const MOBILE_DRAWER_TITLE_CLASS =
  "text-lg font-semibold leading-none tracking-tight text-sidebar-foreground";

export const MOBILE_DRAWER_SHELL_CLASS =
  "h-auto max-h-none overflow-hidden p-0";

/** Default extra stage height for keyboard / accessory clearance. */
export const MOBILE_DRAWER_KEYBOARD_CLEARANCE_PX = 72;

/** Additional drawer shell height above the visual viewport when the keyboard is open. */
export const MOBILE_DRAWER_KEYBOARD_SHELL_EXTRA_PX = 56;

export const mobileDrawerViewVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
  }),
};
