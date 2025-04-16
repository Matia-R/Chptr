'use client'

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { api } from "~/trpc/react"

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
        return (
            <div className="min-h-screen p-4 md:p-8 lg:p-12">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-lg bg-red-50 p-4">
                        <h3 className="text-lg font-medium text-red-800">Error loading document</h3>
                        <p className="mt-2 text-red-700">{error.message}</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!documentData?.document?.content) {
        return (
            <div className="min-h-screen p-4 md:p-8 lg:p-12">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-lg bg-red-50 p-4">
                        <h3 className="text-lg font-medium text-red-800">Error loading document</h3>
                        <p className="mt-2 text-red-700">Document content not found</p>
                    </div>
                </div>
            </div>
        )
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
