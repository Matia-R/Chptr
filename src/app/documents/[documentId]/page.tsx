'use client'

import { useParams } from "next/navigation"

export default function DocumentPage() {
    const params = useParams()
    const documentId = params.documentId as string

    return (
        <div>
            {documentId}
        </div>
    )
}
