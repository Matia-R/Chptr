import type { NextRequest, NextResponse } from "next/server";

/** First path segment reserved for app routes (not `/:user/:slug` published docs). */
const RESERVED_FIRST_SEGMENTS = new Set([
  "api",
  "documents",
  "account",
  "login",
  "signup",
  "welcome",
  "confirm-signup",
  "error",
  "auth",
]);

/**
 * Published docs are a React tree from the stored blocks. Author text is
 * escaped there, so this header does not try to police scripts or styles.
 * Those directives were blocking the app's own inline styles and the Vercel
 * toolbar. Framing, plugins, `<base>`, and image sources are still locked down.
 */
function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const proto = forwarded.split(",")[0]?.trim();
    if (proto === "https") return true;
    if (proto === "http") return false;
  }
  return request.nextUrl.protocol === "https:";
}

function buildPublishedDocumentCsp({ secure }: { secure: boolean }): string {
  const directives = [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data: blob:",
  ];
  // Safari upgrades http://localhost subresources to https://localhost when this
  // directive is present, breaking CSS/fonts in local dev (WebKit bug #250776).
  if (secure) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

/**
 * Apply to `/:username/:slug`-style paths only (two segments, non-reserved first segment).
 */
export function applyPublishedDocumentSecurityHeaders(
  pathname: string,
  response: NextResponse,
  request: NextRequest,
): void {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return;
  const first = parts[0];
  if (!first || RESERVED_FIRST_SEGMENTS.has(first)) return;

  response.headers.set(
    "Content-Security-Policy",
    buildPublishedDocumentCsp({ secure: isSecureRequest(request) }),
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}
