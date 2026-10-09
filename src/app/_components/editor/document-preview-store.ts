"use client";

import { create } from "zustand";

import type { DocumentFontId } from "~/lib/document-fonts";
import type { PublishedAuthorProfileRow } from "~/lib/published-author";

export type DocumentPreviewSnapshot = {
  title: string;
  blocks: unknown;
  publishedAt: string;
  ownerUsername: string;
  authorProfile: PublishedAuthorProfileRow | null;
  font: DocumentFontId;
};

type DocumentPreviewStore = {
  open: boolean;
  generation: number;
  snapshot: DocumentPreviewSnapshot | null;
  openPreview: (snapshot: DocumentPreviewSnapshot) => void;
  closePreview: () => void;
};

export const useDocumentPreviewStore = create<DocumentPreviewStore>((set) => ({
  open: false,
  generation: 0,
  snapshot: null,
  openPreview: (snapshot) =>
    set((state) => ({
      open: true,
      snapshot,
      generation: state.generation + 1,
    })),
  closePreview: () => set({ open: false }),
}));
