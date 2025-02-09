'use client'

import { useParams } from "next/navigation"
import { Editor } from "~/app/_components/dynamic-editor"
import { type Block } from "@blocknote/core"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string

    // Create initial content with document ID as heading
    const initialContent: Block[] = [
        {
            id: "1",
            type: "heading",
            props: {
                textColor: "default",
                backgroundColor: "default",
                textAlignment: "left",
                level: 1
            },
            content: [
                {
                    type: "text",
                    text: `Document: ${documentId}`,
                    styles: {}
                }
            ],
            children: []
        }
    ]

    return (
        <div className="min-h-screen p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)]">
                <Editor initialContent={initialContent} />
            </div>
        </div>
    )
}
