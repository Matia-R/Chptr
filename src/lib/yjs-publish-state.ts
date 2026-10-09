import type * as Y from "yjs";

import { readDocumentFontId } from "~/lib/document-font-state";
import { DEFAULT_DOCUMENT_FONT_ID } from "~/lib/document-fonts";

/** Shared Y.Map: every collaborator sees the same published snapshot. */
export const YJS_PUBLISH_MAP = "chptr-publish";
export const YJS_PUBLISH_ORIGIN = "chptr-publish";
export const YJS_DOCUMENT_FRAGMENT = "document-store";

function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash of the collaborative document body plus a non-default font.
 * Inter is omitted so documents published before fonts existed keep the same hash.
 */
export function getYjsContentHash(ydoc: Y.Doc): string {
  const json = ydoc.getXmlFragment(YJS_DOCUMENT_FRAGMENT).toJSON();
  const body = `${json.length.toString(16)}:${fnv1a(json)}`;
  const fontId = readDocumentFontId(ydoc);
  if (fontId === DEFAULT_DOCUMENT_FONT_ID) return body;
  return `${body}:${fontId}`;
}

export function getYjsPublishedContentHash(ydoc: Y.Doc): string | undefined {
  const value = ydoc.getMap<string>(YJS_PUBLISH_MAP).get("contentHash");
  return typeof value === "string" ? value : undefined;
}

/** Write the current body hash into the shared Y.Doc so all clients flip to Published. */
export function writeYjsPublishedContentHash(ydoc: Y.Doc): string {
  const contentHash = getYjsContentHash(ydoc);
  ydoc.transact(() => {
    ydoc.getMap<string>(YJS_PUBLISH_MAP).set("contentHash", contentHash);
  }, YJS_PUBLISH_ORIGIN);
  return contentHash;
}
