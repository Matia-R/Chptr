"use client"

import { create } from "zustand"

interface CommandMenuState {
    isOpen: boolean
    setOpen: (open: boolean) => void
}

export const useCommandMenuStore = create<CommandMenuState>((set) => ({
    isOpen: false,
    setOpen: (open: boolean) => set({ isOpen: open })
}))

export function useCommandMenu(): CommandMenuState {
    const store = useCommandMenuStore()
    return {
        isOpen: store.isOpen,
        setOpen: store.setOpen
    }
} 