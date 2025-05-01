'use client'

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { api } from "~/trpc/react"
import { DocumentError } from "~/app/_components/document-error"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string
    const Editor = useMemo(() => dynamic(() => import("~/app/_components/editor/editor"), { ssr: false }), []);

    const { data: documentData, isLoading, error } = api.document.getDocumentById.useQuery(documentId)

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-9 w-2/3 bg-muted rounded-lg" /> {/* Title skeleton */}
                <div className="space-y-3">
                    {/* Paragraph skeletons */}
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-4 bg-muted rounded w-[95%]" />
                    <div className="h-4 bg-muted rounded w-[90%]" />
                </div>
                <div className="space-y-3 pt-4">
                    {/* More paragraph blocks */}
                    <div className="h-4 bg-muted rounded w-[85%]" />
                    <div className="h-4 bg-muted rounded w-[88%]" />
                    <div className="h-4 bg-muted rounded w-[92%]" />
                </div>
            </div>
        )
    }

    if (error) {
        return <DocumentError title="Error loading document" message={error.message} />
    }

    if (!documentData?.document?.content) {
        return <DocumentError title="Error loading document" message="Document content not found" />
    }

    return (
        <div className="min-h-screen p-4 md:p-0">
            <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)]">
                <Editor
                    initialContent={documentData.document.content}
                    documentId={documentId}
                />
            </div>
        </div>
    )
}
