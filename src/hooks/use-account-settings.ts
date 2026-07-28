"use client";

import { create } from "zustand";

/** Sub-screens of the account settings surface (drill-down views on mobile). */
export type AccountSettingsView =
  | "main"
  | "profile"
  | "first_name"
  | "last_name"
  | "username"
  | "password";

/** Profile text fields that edit on their own mobile screen. */
export type AccountProfileField = "first_name" | "last_name" | "username";

interface AccountSettingsState {
  isOpen: boolean;
  view: AccountSettingsView;
  setOpen: (open: boolean) => void;
  setView: (view: AccountSettingsView) => void;
  open: () => void;
  close: () => void;
}

export const useAccountSettingsStore = create<AccountSettingsState>((set) => ({
  isOpen: false,
  view: "main",
  setOpen: (open: boolean) =>
    set(open ? { isOpen: true } : { isOpen: false, view: "main" }),
  setView: (view: AccountSettingsView) => set({ view }),
  open: () => set({ isOpen: true, view: "main" }),
  close: () => set({ isOpen: false, view: "main" }),
}));
