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

    // Todo: create a query to just get the name so we're not fetching the whole document
    const { data: document, isLoading } = api.document.getDocumentById.useQuery(documentId, {
        enabled: !!documentId
    })

    const updateName = api.document.updateDocumentName.useMutation({
        onError: (err) => {
            // Always revert to the current document name
            if (document?.document?.name) {
                setEditingName(document.document.name)
            }

            // Revert both caches on error
            if (document?.document) {
                utils.document.getDocumentById.setData(documentId, document)
            }

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
    const [editingName, setEditingName] = useState("")

    // Update editing state when document name changes or when starting to edit
    React.useEffect(() => {
        if (document?.document?.name) {
            setEditingName(document.document.name)
        }
    }, [document?.document?.name])

    const handleSave = () => {
        const trimmedName = editingName.trim()

        // If no valid name or no change, just cancel
        if (!trimmedName || !document?.document?.name || trimmedName === document.document.name) {
            handleCancel()
            return
        }

        // Snapshot the previous values
        const prevDocs = utils.document.getDocumentIdsForAuthenticatedUser.getData()
        const prevDoc = utils.document.getDocumentById.getData(documentId)

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

        // Optimistically update the document data
        if (document?.document) {
            utils.document.getDocumentById.setData(documentId, {
                ...document,
                document: {
                    ...document.document,
                    name: trimmedName
                }
            })
        }

        updateName.mutate({ id: documentId, name: trimmedName }, {
            onError: () => {
                // Revert both caches on error
                if (prevDocs) {
                    utils.document.getDocumentIdsForAuthenticatedUser.setData(undefined, prevDocs)
                }
                if (prevDoc) {
                    utils.document.getDocumentById.setData(documentId, prevDoc)
                }
            }
        })
        setIsEditing(false)
    }

    const handleCancel = () => {
        // Always revert to the current document name
        if (document?.document?.name) {
            setEditingName(document.document.name)
        }
        setIsEditing(false)
    }

    const sharedStyles = "w-[200px] py-1 px-2 rounded-sm text-sm text-foreground font-semibold focus-visible:ring-1 focus-visible:ring-ring outline-none"

    // Don't render anything until we have the document data
    if (isLoading || !document?.document?.name) {
        return (
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem className="md:block">
                        <div className={cn(sharedStyles, "bg-accent animate-pulse h-4")} />
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
        )
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem className="md:block">
                    <div className="relative group">
                        {isEditing ? (
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
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
                                    title={document.document.name}
                                >
                                    {document.document.name}
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