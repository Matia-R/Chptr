"use client"

import { useState, useEffect } from "react"
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandDialog, CommandGroup } from "./command"
import { api } from "~/trpc/react"
import { useRouter } from "next/navigation"
import { FileText, SunMoon, FilePlus } from "lucide-react"
import { DialogTitle } from "./dialog"
import { useCommandMenuStore } from "~/hooks/use-command-menu"
import { useTheme } from "next-themes"
import { useToast } from "~/hooks/use-toast"
import { type Document } from "~/server/api/routers/document"

export function CommandMenu() {
    const [search, setSearch] = useState("")
    const router = useRouter()
    const utils = api.useUtils()
    const { toast } = useToast()
    const { data: documents } = api.document.getDocumentIdsForAuthenticatedUser.useQuery()
    const isOpen = useCommandMenuStore((state) => state.isOpen)
    const setOpen = useCommandMenuStore((state) => state.setOpen)
    const closeAll = useCommandMenuStore((state) => state.closeAll)
    const { theme, setTheme } = useTheme()

    const createDocument = api.document.createDocument.useMutation({
        onSuccess: async (data) => {
            const doc = data.createdDocument[0] as Document;
            if (doc?.id) {
                // Invalidate both the document list and the new document
                await Promise.all([
                    utils.document.getDocumentIdsForAuthenticatedUser.invalidate(),
                    utils.document.getDocumentById.prefetch(doc.id)
                ]);
                router.push(`/documents/${doc.id}`);
                closeAll();
            }
            else {
                toast({
                    title: "Failed to create document",
                    description: "The document was created but returned an invalid ID."
                });
            }
        },
        onError: (error) => {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Failed to create document",
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            });
        }
    });

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(true)
                // Highlight the search text in the sidebar
                const searchButton = document.querySelector('[data-search-button]')
                if (searchButton) {
                    searchButton.setAttribute('data-highlight', 'true')
                    setTimeout(() => {
                        searchButton.setAttribute('data-highlight', 'false')
                    }, 1000)
                }
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [setOpen])

    const allDocs = documents?.documents ?? []
    const displayedDocs = search ? allDocs : allDocs.slice(0, 5)

    return (
        <CommandDialog open={isOpen} onOpenChange={setOpen}>
            <DialogTitle className="sr-only">Command Menu</DialogTitle>
            <Command>
                <CommandInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Type a command or search..."
                />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Notes">
                        {displayedDocs.map((doc) => (
                            <CommandItem
                                key={doc.id}
                                value={doc.name + "_" + doc.id}
                                onSelect={() => {
                                    router.push(`/documents/${doc.id}`)
                                    closeAll()
                                }}
                            >
                                <FileText className="mr-2 h-4 w-4" />
                                {doc.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    <CommandGroup heading="Quick Actions">
                        <CommandItem
                            value="new-note"
                            onSelect={() => {
                                createDocument.mutate()
                            }}
                            disabled={createDocument.status === 'pending'}
                        >
                            <FilePlus className="mr-2 h-4 w-4" />
                            New note
                        </CommandItem>
                        <CommandItem
                            value="toggle-theme"
                            onSelect={() => {
                                setTheme(theme === "dark" ? "light" : "dark")
                                closeAll()
                            }}
                        >
                            <SunMoon className="mr-2 h-4 w-4" />
                            Toggle theme
                            <span className="ml-auto text-xs text-muted-foreground">Current: {theme}</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    )
}
