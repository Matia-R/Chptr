import { cn } from "~/lib/utils";

/** Solid scrim — no enter opacity animation (Vaul overlay stays invisible with fade-in-0). */
export const drawerOverlayClass = cn(
  "drawer-scrim fixed inset-0 z-40 bg-black/80",
);

/** Dialog/sheet scrim — Radix drives data-state reliably for fade. */
export const dialogOverlayClass = cn(
  "overlay-backdrop fixed inset-0 z-50 bg-black/80",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "duration-200",
);

function getDefaultThemeColor() {
  return document.documentElement.classList.contains("dark")
    ? "#1a1a1a"
    : "#ffffff";
}

/** ~80% black scrim composited over the page background. */
function getOverlayThemeColor() {
  return document.documentElement.classList.contains("dark")
    ? "#050505"
    : "#333333";
}

function setThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function isOverlayDimmed() {
  return (
    document.documentElement.hasAttribute("data-drawer-overlay") ||
    document.body.hasAttribute("data-scroll-locked")
  );
}

function clearOverlayChrome() {
  delete document.documentElement.dataset.overlayOpen;
  setThemeColor(getDefaultThemeColor());
}

/** Drive iOS safe-area chrome — instant snap, separate from scrim opacity. */
export function refreshOverlayChrome() {
  const html = document.documentElement;

  if (isOverlayDimmed()) {
    html.dataset.overlayOpen = "";
    setThemeColor(getOverlayThemeColor());
    return;
  }

  clearOverlayChrome();
}

export function setOverlayOpen(open: boolean) {
  const html = document.documentElement;

  if (open) {
    html.dataset.drawerOverlay = "";
    refreshOverlayChrome();
    return;
  }

  delete html.dataset.drawerOverlay;
  // Clear immediately — Radix can keep data-scroll-locked briefly after close,
  // which would otherwise leave the safe-area chrome dimmed via :has() / refresh.
  clearOverlayChrome();
}
