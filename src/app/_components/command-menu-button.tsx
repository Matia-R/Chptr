"use client"

import { Button } from "./ui/button"
import { useCommandMenuStore } from "~/hooks/use-command-menu"

export function CommandMenuButton() {
    const setOpen = useCommandMenuStore((state) => state.setOpen)

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        >
            Jump to ⌘K
        </Button>
    )
} 