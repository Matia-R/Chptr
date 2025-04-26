"use client"

import { useParams } from "next/navigation"
import { api } from "~/trpc/react"
import { BreadcrumbItem, Breadcrumb, BreadcrumbList } from "./breadcrumb"
import { useState } from "react"
import * as React from "react"
import { cn } from "~/lib/utils"
import { useToast } from "../../hooks/use-toast"
import { SquarePen, X } from "lucide-react"

export function DocumentBreadcrumb() {
    const params = useParams()
    const documentId = params.documentId as string
    const utils = api.useUtils()
    const { toast } = useToast()

    const { data: document } = api.document.getDocumentById.useQuery(documentId, {
        enabled: !!documentId
    })

    const updateName = api.document.updateDocumentName.useMutation({
        onError: (err) => {

            setName(document?.document?.name ?? "Untitled")

            toast({
                variant: "destructive",
                title: "Failed to update document name",
                description: err instanceof Error ? err.message : "An unexpected error occurred"
            })
        },
        onSettled: () => {
            void utils.document.getDocumentIdsForAuthenticatedUser.invalidate()
        }
    })

    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(document?.document?.name ?? "Untitled")

    // Update local state when document name changes
    React.useEffect(() => {
        if (document?.document?.name) {
            setName(document.document.name)
        }
    }, [document?.document?.name])

    const handleSave = () => {
        const trimmedName = name.trim()
        if (!trimmedName) {
            handleCancel()
            return
        }

        if (documentId && trimmedName !== document?.document?.name) {
            // Snapshot the previous value
            const prevDocs = utils.document.getDocumentIdsForAuthenticatedUser.getData()

            // Optimistically update the documents list
            utils.document.getDocumentIdsForAuthenticatedUser.setData(undefined, old => {
                if (!old?.documents) return old
                return {
                    ...old,
                    documents: old.documents.map(doc =>
                        doc.id === documentId ? { ...doc, name: trimmedName } : doc
                    )
                }
            })

            updateName.mutate({ id: documentId, name: trimmedName }, {
                onError: () => {
                    // Revert on error
                    if (prevDocs) {
                        utils.document.getDocumentIdsForAuthenticatedUser.setData(undefined, prevDocs)
                    }
                }
            })
        }
        setIsEditing(false)
    }

    const handleCancel = () => {
        setName(document?.document?.name ?? "Untitled")
        setIsEditing(false)
    }

    const sharedStyles = "w-[200px] py-1 px-2 rounded-sm text-sm"

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem className="md:block">
                    <div className="relative group">
                        {isEditing ? (
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") {
                                            handleSave()
                                        }
                                        if (e.key === "Escape") {
                                            handleCancel()
                                        }
                                    }}
                                    className={cn(
                                        sharedStyles,
                                        "bg-transparent outline-none pr-8",
                                        "focus:bg-accent focus:text-accent-foreground truncate"
                                    )}
                                    autoFocus
                                />
                                <button
                                    onMouseDown={(e) => {
                                        // Prevent the input's onBlur from firing
                                        e.preventDefault()
                                    }}
                                    onClick={handleCancel}
                                    className="absolute right-1 p-1 rounded-sm hover:bg-accent/50"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className={cn(
                                        sharedStyles,
                                        "text-left hover:bg-accent hover:text-accent-foreground pr-8 truncate"
                                    )}
                                    title={name}
                                >
                                    {name}
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="absolute right-1 p-1 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent/50"
                                >
                                    <SquarePen className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    )
} 