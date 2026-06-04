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
 * Published docs are public, user-supplied HTML (sanitized). Add CSP + hardening headers.
 * Next.js still needs script-src inline/eval for the app bundle; XSS is primarily stopped by DOMPurify.
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
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https: data:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
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
