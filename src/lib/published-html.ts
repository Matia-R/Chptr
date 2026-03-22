import DOMPurify from "isomorphic-dompurify";
import type { Config } from "dompurify";

/**
 * DOMPurify config for BlockNote-exported article HTML (rich text, code blocks,
 * tables, data-* attributes, limited inline style from highlighters).
 */
const SANITIZE_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ALLOW_DATA_ATTR: true,
  ADD_TAGS: ["mark", "figure", "figcaption", "picture", "source"],
  ADD_ATTR: ["target", "rel", "loading", "decoding"],
  // External links from the editor should not get window.opener access
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize published article HTML before storing or before rendering.
 * Always run on output (defense in depth with CSP on published routes).
 */
export function sanitizePublishedHtml(html: string): string {
  if (!html.trim()) return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
