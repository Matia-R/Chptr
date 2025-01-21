"use client"

import { Editor } from "../_components/dynamic-editor"

export default function TestDocument() {
    return (
        <div className="min-h-screen p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-5xl h-[calc(100vh-8rem)]">
                <Editor />
            </div>
        </div>
    )
}