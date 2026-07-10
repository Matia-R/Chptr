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

type ThemeColorScheme = "light" | "dark" | "default";

const DEFAULT_THEME_COLORS: Record<ThemeColorScheme, string> = {
  light: "#ffffff",
  dark: "#1a1a1a",
  default: "#ffffff",
};

const OVERLAY_THEME_COLORS: Record<ThemeColorScheme, string> = {
  light: "#333333",
  dark: "#050505",
  default: "#333333",
};

function getThemeColorScheme(meta: HTMLMetaElement): ThemeColorScheme {
  const media = meta.media;
  if (media.includes("dark")) return "dark";
  if (media.includes("light")) return "light";
  return "default";
}

function forEachThemeColorMeta(
  apply: (meta: HTMLMetaElement, scheme: ThemeColorScheme) => void,
) {
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    apply(meta, document.documentElement.classList.contains("dark") ? "dark" : "light");
    return;
  }

  metas.forEach((meta) => {
    apply(meta, getThemeColorScheme(meta));
  });
}

function activeThemeScheme(): Exclude<ThemeColorScheme, "default"> {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Safari often ignores content updates on media-conditioned theme-color metas.
 * Keep those in sync, and also stamp a media-less meta Safari reliably repaints.
 */
function setThemeColors(colors: Record<ThemeColorScheme, string>) {
  forEachThemeColorMeta((meta, scheme) => {
    meta.content =
      scheme === "default" ? colors[activeThemeScheme()] : colors[scheme];
  });

  let active = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );

  if (!active) {
    active = document.createElement("meta");
    active.name = "theme-color";
    document.head.appendChild(active);
  }

  active.content = colors[activeThemeScheme()];
}

function setDefaultThemeColors() {
  setThemeColors(DEFAULT_THEME_COLORS);
}

function setOverlayThemeColors() {
  setThemeColors(OVERLAY_THEME_COLORS);
}

function isOverlayDimmed() {
  return (
    document.documentElement.hasAttribute("data-drawer-overlay") ||
    document.body.hasAttribute("data-scroll-locked")
  );
}

function clearOverlayChrome() {
  if (isOverlayDimmed()) return;

  delete document.documentElement.dataset.overlayOpen;
  setDefaultThemeColors();
}

/** Drive iOS safe-area chrome — instant snap, separate from scrim opacity. */
export function refreshOverlayChrome() {
  const html = document.documentElement;

  if (isOverlayDimmed()) {
    html.dataset.overlayOpen = "";
    setOverlayThemeColors();
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
  refreshOverlayChrome();
}
