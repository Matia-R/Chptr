"use client"

import { create } from "zustand"

interface CommandMenuState {
    isOpen: boolean
    setOpen: (open: boolean) => void
    closeAll: () => void
}

export const useCommandMenuStore = create<CommandMenuState>((set) => ({
    isOpen: false,
    setOpen: (open: boolean) => set({ isOpen: open }),
    closeAll: () => {
        // Close the command menu
        set({ isOpen: false })
        // Close the mobile sidebar if it exists
        const sidebar = document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]')
        if (sidebar) {
            const closeEvent = new CustomEvent('close-mobile-sidebar')
            window.dispatchEvent(closeEvent)
        }
    }
}))

export function useCommandMenu(): CommandMenuState {
    const store = useCommandMenuStore()
    return {
        isOpen: store.isOpen,
        setOpen: store.setOpen,
        closeAll: store.closeAll
    }
} 