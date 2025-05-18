"use client"

import { useParams } from "next/navigation"
import { api } from "~/trpc/react"
import { MoreVertical } from "lucide-react"
import { Button } from "./button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu"

export function DocumentActions() {
    const params = useParams()
    const documentId = params.documentId as string
    const { data } = api.document.getDocumentById.useQuery(documentId, {
        enabled: !!documentId
    })

    if (!data?.document?.last_updated) {
        return null
    }

    const lastUpdated = new Date(data.document.last_updated)
    const now = new Date()

    const monthDay = lastUpdated.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
    })

    const dateStr = lastUpdated.getFullYear() === now.getFullYear()
        ? monthDay
        : `${monthDay}, ${lastUpdated.getFullYear()}`

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <div className="text-sm px-2 py-1.5 text-muted-foreground">
                    Edited {dateStr}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
} 