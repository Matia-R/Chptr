import { MOBILE_DRAWER_KEYBOARD_SHELL_EXTRA_PX } from "./constants";

/** Clear Vaul inline styles applied while the keyboard was open. */
export function resetMobileDrawerKeyboardStyles() {
  const drawer = document.querySelector("[data-vaul-drawer]");
  if (!(drawer instanceof HTMLElement)) return;
  drawer.style.removeProperty("bottom");
  drawer.style.removeProperty("height");
  drawer.style.removeProperty("top");
}

/** Run after the software keyboard has dismissed (iOS visual viewport). */
export function waitForMobileDrawerKeyboardDismiss(callback: () => void) {
  const viewport = window.visualViewport;
  const fallbackMs = 400;

  const finish = () => {
    callback();
  };

  if (!viewport) {
    window.setTimeout(finish, fallbackMs);
    return;
  }

  const keyboardLikelyOpen = () => viewport.height < window.innerHeight * 0.85;

  if (!keyboardLikelyOpen()) {
    finish();
    return;
  }

  let done = false;
  const complete = () => {
    if (done) return;
    done = true;
    viewport.removeEventListener("resize", onResize);
    finish();
  };

  const onResize = () => {
    if (!keyboardLikelyOpen()) {
      complete();
    }
  };

  viewport.addEventListener("resize", onResize);
  window.setTimeout(complete, fallbackMs);
}

/** Nudge the Vaul drawer taller when the keyboard is open. */
export function applyMobileDrawerKeyboardInset(
  extraPx = MOBILE_DRAWER_KEYBOARD_SHELL_EXTRA_PX,
) {
  const drawer = document.querySelector("[data-vaul-drawer]");
  const viewport = window.visualViewport;
  if (!(drawer instanceof HTMLElement) || !viewport) return;

  const keyboardOpen = viewport.height < window.innerHeight * 0.85;
  if (!keyboardOpen) return;

  const targetHeight = viewport.height + extraPx;
  if (drawer.getBoundingClientRect().height < targetHeight - 1) {
    drawer.style.height = `${targetHeight}px`;
  }
}

export function focusMobileDrawerInput(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  } catch {
    input.focus({ preventScroll: true });
  }
}
