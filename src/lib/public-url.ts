/** Host shown in author-facing URL previews. */
export const PUBLIC_SITE_HOST = "chptr.io";

/** Public article root for a handle, e.g. `chptr.io/janemitchell`. */
export function publicHandleUrl(handle: string): string {
  return `${PUBLIC_SITE_HOST}/${handle.trim().toLowerCase()}`;
}
