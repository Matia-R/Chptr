/**
 * Content hash for stable block identity. Same algorithm on client and server
 * so (document_id, content_hash) uniquely identifies "this block's content" for review feedback.
 */

export async function sha256Hex(text: string): Promise<string> {
  const normalized = text.trim();
  const bytes = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
