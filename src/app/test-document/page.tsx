"use client"

import { Editor } from "../_components/dynamic-editor"
import { type PartialBlock } from "@blocknote/core"
import { useEffect, useState } from "react"

async function loadFromStorage() {
    // Gets the previously stored editor contents.
    const storageString = localStorage.getItem("editorContent");
    return storageString
        ? (JSON.parse(storageString) as PartialBlock[])
        : undefined;
}

export default function TestDocument() {
    const [content, setContent] = useState<PartialBlock[] | undefined>(undefined)

    useEffect(() => {
        loadFromStorage()
            .then(savedContent => {
                if (savedContent) {
                    setContent(savedContent)
                } else {
                    // If no saved content, use empty content
                    setContent([])
                }
            })
            .catch(error => {
                console.error("Failed to load editor content:", error)
                setContent([])
            })
    }, [])

    if (!content) {
        return <div>Loading...</div>
    }

    return (
        <div className="min-h-screen p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)]">
                <Editor initialContent={content} />
            </div>
        </div>
    )
}