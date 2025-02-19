'use client'

import { useParams } from "next/navigation"
import { Editor } from "~/app/_components/dynamic-editor"
import { api } from "~/trpc/react"
import { useEffect, useMemo } from "react"
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string

    // Create YJS doc and provider for each document instance
    const ydoc = useMemo(() => new Y.Doc(), []);
    const provider = useMemo(
        () => new WebrtcProvider(`document-${documentId}`, ydoc),
        [documentId, ydoc]
    );
    const fragment = useMemo(() => ydoc.getXmlFragment("document-store"), [ydoc]);

    const { data: documentData, isLoading, error } = api.document.getDocumentById.useQuery(documentId)

    // Cleanup Y.js resources
    useEffect(() => {
        return () => {
            provider.destroy();
            ydoc.destroy();
        };
    }, [provider, ydoc]);

    if (isLoading) {
        return <div>Loading...</div>
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
        <div className="min-h-screen p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)]">
                <Editor
                    initialContent={documentData.document.content}
                    documentId={documentId}
                    provider={provider}
                    fragment={fragment}
                />
            </div>
        </div>
    )
}