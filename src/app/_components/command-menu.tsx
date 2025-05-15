"use client"

import { useState, useEffect } from "react"
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandDialog, CommandGroup } from "./command"
import { api } from "~/trpc/react"
import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import { DialogTitle } from "./dialog"

export function CommandMenu() {
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const { data: documents } = api.document.getDocumentIdsForAuthenticatedUser.useQuery()

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    const allDocs = documents?.documents ?? []

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <DialogTitle className="sr-only">Command Menu</DialogTitle>
            <Command>
                <CommandInput
                    placeholder="Type a command or search..."
                />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Notes">
                        {allDocs.map((doc) => (
                            <CommandItem
                                key={doc.id}
                                value={doc.id}
                                onSelect={() => {
                                    router.push(`/documents/${doc.id}`)
                                    setOpen(false)
                                }}
                            >
                                <FileText className="mr-2 h-4 w-4" />
                                {doc.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    <CommandGroup heading="Suggestions">
                        <CommandItem value="calendar">Calendar</CommandItem>
                        <CommandItem value="search-emoji">Search Emoji</CommandItem>
                        <CommandItem value="calculator">Calculator</CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    )
}
