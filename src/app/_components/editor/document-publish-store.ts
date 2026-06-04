"use client";

import { create } from "zustand";

export type PublishFeedbackState =
  | "idle"
  | "publishing"
  | "published"
  | "failed";

export type MobileDrawerView = "main" | "edit-url";

type DocumentPublishStore = {
  popoverOpen: boolean;
  mobileDrawerOpen: boolean;
  mobileDrawerView: MobileDrawerView;
  slugOverride: string;
  publishFeedback: PublishFeedbackState;
  freezeFirstPublishActions: boolean;
  setPopoverOpen: (open: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setMobileDrawerView: (view: MobileDrawerView) => void;
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
  mobileDrawerView: "main",
  slugOverride: "",
  publishFeedback: "idle",
  freezeFirstPublishActions: false,
  setPopoverOpen: (open) => set({ popoverOpen: open }),
  setMobileDrawerOpen: (open) =>
    set((state) => ({
      mobileDrawerOpen: open,
      mobileDrawerView: open ? state.mobileDrawerView : "main",
    })),
  setMobileDrawerView: (view) => set({ mobileDrawerView: view }),
  setSlugOverride: (value) => set({ slugOverride: value }),
  setPublishFeedback: (state) => set({ publishFeedback: state }),
  setFreezeFirstPublishActions: (value) =>
    set({ freezeFirstPublishActions: value }),
  revertSlug: () => set({ slugOverride: "" }),
  onAuxiliaryOpen: () => set({ freezeFirstPublishActions: false }),
  closeBothPanels: () =>
    set({
      popoverOpen: false,
      mobileDrawerOpen: false,
      mobileDrawerView: "main",
    }),
  resetForNavigation: () =>
    set({
      popoverOpen: false,
      mobileDrawerOpen: false,
      mobileDrawerView: "main",
      slugOverride: "",
      publishFeedback: "idle",
      freezeFirstPublishActions: false,
    }),
}));
