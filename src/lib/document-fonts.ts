import type { CSSProperties } from "react";

/**
 * Document-level faces. Add a font by extending this list and loading its
 * CSS variable in the root layout. Identifiers are stored, never a raw
 * font-family string.
 */
export const DOCUMENT_FONT_IDS = [
  "inter",
  "geist",
  "lora",
  "merriweather",
  "ibm-plex-mono",
  "source-serif-4",
] as const;

export type DocumentFontId = (typeof DOCUMENT_FONT_IDS)[number];

export type DocumentFontCategory = "Sans serif" | "Serif" | "Monospace";

export type DocumentFont = {
  id: DocumentFontId;
  name: string;
  category: DocumentFontCategory;
  /** CSS font-family: next/font variable first, then a named fallback. */
  family: string;
};

export const DEFAULT_DOCUMENT_FONT_ID: DocumentFontId = "inter";

export const DOCUMENT_FONTS: readonly DocumentFont[] = [
  {
    id: "inter",
    name: "Inter",
    category: "Sans serif",
    family: 'var(--font-inter), "Inter", sans-serif',
  },
  {
    id: "geist",
    name: "Geist",
    category: "Sans serif",
    family: 'var(--font-geist-sans), "Geist", sans-serif',
  },
  {
    id: "lora",
    name: "Lora",
    category: "Serif",
    family: 'var(--font-lora), "Lora", serif',
  },
  {
    id: "merriweather",
    name: "Merriweather",
    category: "Serif",
    family: 'var(--font-merriweather), "Merriweather", serif',
  },
  {
    id: "ibm-plex-mono",
    name: "IBM Plex Mono",
    category: "Monospace",
    family:
      'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, monospace',
  },
  {
    id: "source-serif-4",
    name: "Source Serif 4",
    category: "Serif",
    family: 'var(--font-source-serif-4), "Source Serif 4", serif',
  },
];

const FONT_BY_ID = new Map(DOCUMENT_FONTS.map((font) => [font.id, font]));

export function isDocumentFontId(value: unknown): value is DocumentFontId {
  return typeof value === "string" && FONT_BY_ID.has(value as DocumentFontId);
}

export function getDocumentFont(fontId: DocumentFontId): DocumentFont {
  return FONT_BY_ID.get(fontId) ?? FONT_BY_ID.get(DEFAULT_DOCUMENT_FONT_ID)!;
}

/** Unknown or missing values are Inter, including documents saved before fonts existed. */
export function resolveDocumentFontId(value: unknown): DocumentFontId {
  return isDocumentFontId(value) ? value : DEFAULT_DOCUMENT_FONT_ID;
}

export function documentFontStyle(fontId: DocumentFontId): CSSProperties {
  return {
    "--document-font-family": getDocumentFont(fontId).family,
  } as CSSProperties;
}
