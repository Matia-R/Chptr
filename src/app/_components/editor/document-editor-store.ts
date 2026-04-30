"use client";

import { create } from "zustand";

import type { AppBlockNoteEditor } from "./editor-types";

type DocumentEditorState = {
  editor: AppBlockNoteEditor | null;
  setEditor: (editor: AppBlockNoteEditor | null) => void;
};

export const useDocumentEditorStore = create<DocumentEditorState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
}));
