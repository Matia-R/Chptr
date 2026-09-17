"use client";

import { create } from "zustand";

interface DocumentTrashState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
}

export const useDocumentTrashStore = create<DocumentTrashState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
