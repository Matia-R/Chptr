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

/**
 * Publish UI timers are module-scoped so they survive panel unmount.
 * `useDocumentPublish` is mounted in the header, popover, and drawer; closing
 * a panel must not cancel the idle reset or the label stays on "Published".
 */
let feedbackResetTimeoutId: number | null = null;
let closePanelsTimeoutId: number | null = null;

export function clearPublishUiTimeouts() {
  if (feedbackResetTimeoutId != null) {
    window.clearTimeout(feedbackResetTimeoutId);
    feedbackResetTimeoutId = null;
  }
  if (closePanelsTimeoutId != null) {
    window.clearTimeout(closePanelsTimeoutId);
    closePanelsTimeoutId = null;
  }
}

export function schedulePublishFeedbackReset(delayMs: number) {
  if (feedbackResetTimeoutId != null) {
    window.clearTimeout(feedbackResetTimeoutId);
  }
  feedbackResetTimeoutId = window.setTimeout(() => {
    feedbackResetTimeoutId = null;
    useDocumentPublishStore.getState().setPublishFeedback("idle");
  }, delayMs);
}

export function scheduleClosePublishPanels(delayMs: number) {
  if (closePanelsTimeoutId != null) {
    window.clearTimeout(closePanelsTimeoutId);
  }
  closePanelsTimeoutId = window.setTimeout(() => {
    closePanelsTimeoutId = null;
    useDocumentPublishStore.getState().closeBothPanels();
  }, delayMs);
}

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
  resetForNavigation: () => {
    clearPublishUiTimeouts();
    set({
      popoverOpen: false,
      mobileDrawerOpen: false,
      mobileDrawerView: "main",
      slugOverride: "",
      publishFeedback: "idle",
      freezeFirstPublishActions: false,
    });
  },
}));
