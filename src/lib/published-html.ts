/**
 * Best-effort hardening of BlockNote-exported HTML before storing or rendering.
 * Prefer upgrading to a dedicated HTML sanitizer if you allow untrusted HTML sources.
 */
export function sanitizePublishedHtml(html: string): string {
  let out = html;
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  out = out.replace(
    /\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    "",
  );
  out = out.replace(/\s*javascript:\s*[^"'>\s]+/gi, "");
  return out;
}
