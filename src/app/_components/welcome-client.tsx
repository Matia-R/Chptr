"use client"

import { useRouter } from "next/navigation"
import { api } from "~/trpc/react"
import { Button } from "./ui/button"
import { useState } from "react"
import type { Document } from "~/server/api/routers/document"

interface WelcomeClientProps {
    userName: string
}

export function WelcomeClient({ userName }: WelcomeClientProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const createDocument = api.document.createDocument.useMutation({
        onSuccess: (data) => {
            const doc = data.createdDocument[0] as Document
            if (doc?.id) {
                router.push(`/documents/${doc.id}`)
            }
        },
        onError: (error) => {
            console.error("Failed to create document:", error)
            setIsLoading(false)
        }
    })

    const handleGetStarted = () => {
        setIsLoading(true)
        createDocument.mutate()
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <div className="max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">
                    Welcome to Chptr!
                </h1>
                <p className="text-muted-foreground mb-8">
                    Hi {userName} 👋 Your workspace is ready. Click the button below to create your first note and start writing.
                </p>
                <Button
                    onClick={handleGetStarted}
                    className="w-full py-2 text-sm font-medium"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Creating your first document...
                        </div>
                    ) : (
                        "Get Started"
                    )}
                </Button>
            </div>
        </div>
    )
} 