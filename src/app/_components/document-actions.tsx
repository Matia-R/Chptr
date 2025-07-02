"use client"

import { useParams } from "next/navigation"
import { api } from "~/trpc/react"
import { MoreVertical } from "lucide-react"
import { Button } from "./button"
import {
    DropdownMenu,
    DropdownMenuContent,
    // DropdownMenuItem,
    // DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu"
import { Skeleton } from "./skeleton"

export function DocumentActions() {
    const params = useParams()
    const documentId = params.documentId as string
    const { data, isLoading } = api.document.getDocumentById.useQuery(documentId, {
        enabled: !!documentId
    })

    const renderDate = () => {
        if (isLoading) {
            return <Skeleton className="h-4 w-24" />
        }

        if (!data?.document?.last_updated) {
            return null
        }

        const lastUpdated = new Date(data.document.last_updated)
        const now = new Date()

        const monthDay = lastUpdated.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric'
        })

        return lastUpdated.getFullYear() === now.getFullYear()
            ? monthDay
            : `${monthDay}, ${lastUpdated.getFullYear()}`
    }

    const dateStr = renderDate()
    if (!dateStr && !isLoading) {
        return null
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLoading}>
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <div className="text-sm px-2 py-1.5 text-muted-foreground">
                    {isLoading ? (
                        <div className="flex items-center gap-1">
                            <span>Edited</span>
                            <Skeleton className="h-4 w-24" />
                        </div>
                    ) : (
                        <span>Edited {dateStr as string}</span>
                    )}
                </div>
                {/* <DropdownMenuSeparator /> */}
            </DropdownMenuContent>
        </DropdownMenu>
    )
} 