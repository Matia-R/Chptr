import sanitizeHtml from "sanitize-html";

/**
 * Sanitize config for BlockNote-exported article HTML (rich text, code blocks,
 * tables, data-* attributes, and limited inline style from highlighters).
 */
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "mark",
    "figure",
    "figcaption",
    "picture",
    "source",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["class", "style", "data-*"],
    a: ["href", "name", "target", "rel"],
    img: [
      "src",
      "srcset",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding",
    ],
    source: ["srcset", "type", "media", "sizes"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  // Allow syntax-highlighter styles but keep them constrained.
  allowedStyles: {
    "*": {
      color: [/^[#\w(),.%\s-]+$/],
      "background-color": [/^[#\w(),.%\s-]+$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic|oblique)$/],
      "text-decoration": [/^[\w\s-]+$/],
    },
  },
  transformTags: {
    a: (tagName, attribs) => {
      const relTokens = new Set(
        (attribs.rel ?? "")
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean)
      );
      relTokens.add("noopener");
      relTokens.add("noreferrer");

      return {
        tagName,
        attribs: {
          ...attribs,
          rel: Array.from(relTokens).join(" "),
        },
      };
    },
  },
};

/**
 * Sanitize published article HTML before storing or before rendering.
 * Always run on output (defense in depth with CSP on published routes).
 */
export function sanitizePublishedHtml(html: string): string {
  if (!html.trim()) return "";
  return sanitizeHtml(html, SANITIZE_CONFIG);
}
