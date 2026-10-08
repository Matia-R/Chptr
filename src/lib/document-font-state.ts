import type * as Y from "yjs";

import {
  resolveDocumentFontId,
  type DocumentFontId,
} from "~/lib/document-fonts";

/** Shared Y.Map for document-level settings. Not part of the block tree. */
export const YJS_DOCUMENT_META_MAP = "chptr-meta";
export const YJS_DOCUMENT_FONT_KEY = "font";
export const YJS_DOCUMENT_FONT_ORIGIN = "chptr-font";

export function readDocumentFontId(ydoc: Y.Doc): DocumentFontId {
  // getMap creates the shared type. Reading must not, or opening a doc
  // would write an empty map and look like an edit.
  if (!ydoc.share.has(YJS_DOCUMENT_META_MAP)) {
    return resolveDocumentFontId(undefined);
  }
  const value = ydoc
    .getMap<string>(YJS_DOCUMENT_META_MAP)
    .get(YJS_DOCUMENT_FONT_KEY);
  return resolveDocumentFontId(value);
}

/** No-op when the resolved face is already selected, so Inter stays unset on old docs. */
export function writeDocumentFontId(ydoc: Y.Doc, fontId: DocumentFontId) {
  if (readDocumentFontId(ydoc) === fontId) return;
  const map = ydoc.getMap<string>(YJS_DOCUMENT_META_MAP);
  ydoc.transact(() => {
    map.set(YJS_DOCUMENT_FONT_KEY, fontId);
  }, YJS_DOCUMENT_FONT_ORIGIN);
}
