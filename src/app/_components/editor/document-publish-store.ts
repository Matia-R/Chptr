"use client";

import { create } from "zustand";

export type PublishFeedbackState = "idle" | "publishing" | "published";

type DocumentPublishStore = {
  popoverOpen: boolean;
  mobileDrawerOpen: boolean;
  slugOverride: string;
  publishFeedback: PublishFeedbackState;
  freezeFirstPublishActions: boolean;
  setPopoverOpen: (open: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setSlugOverride: (value: string) => void;
  setPublishFeedback: (state: PublishFeedbackState) => void;
  setFreezeFirstPublishActions: (value: boolean) => void;
  revertSlug: () => void;
  /** Opening popover/sheet: clears first-publish freeze flag only. */
  onAuxiliaryOpen: () => void;
  closeBothPanels: () => void;
  /** When navigating to another document — drops draft slug and panel state. */
  resetForNavigation: () => void;
};

export const useDocumentPublishStore = create<DocumentPublishStore>((set) => ({
  popoverOpen: false,
  mobileDrawerOpen: false,
  slugOverride: "",
  publishFeedback: "idle",
  freezeFirstPublishActions: false,
  setPopoverOpen: (open) => set({ popoverOpen: open }),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  setSlugOverride: (value) => set({ slugOverride: value }),
  setPublishFeedback: (state) => set({ publishFeedback: state }),
  setFreezeFirstPublishActions: (value) =>
    set({ freezeFirstPublishActions: value }),
  revertSlug: () => set({ slugOverride: "" }),
  onAuxiliaryOpen: () => set({ freezeFirstPublishActions: false }),
  closeBothPanels: () =>
    set({ popoverOpen: false, mobileDrawerOpen: false }),
  resetForNavigation: () =>
    set({
      popoverOpen: false,
      mobileDrawerOpen: false,
      slugOverride: "",
      publishFeedback: "idle",
      freezeFirstPublishActions: false,
    }),
}));
