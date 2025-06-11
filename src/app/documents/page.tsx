'use client'

import { ArrowRight } from "lucide-react"
import { Button } from "~/app/_components/ui/button"
import { useRouter } from "next/navigation"
import { api } from "~/trpc/react"
import { useToast } from "~/hooks/use-toast"
import { MotionFade } from "~/app/_components/motion-fade"
import { type Document } from "~/server/api/routers/document"

export default function DocumentsPage() {
    const router = useRouter()
    const utils = api.useUtils()
    const { toast } = useToast()

    const createDocument = api.document.createDocument.useMutation({
        onSuccess: async (data) => {
            const doc = data.createdDocument[0] as Document;
            if (doc?.id) {
                await Promise.all([
                    utils.document.getDocumentIdsForAuthenticatedUser.invalidate(),
                    utils.document.getDocumentById.prefetch(doc.id)
                ]);
                router.push(`/documents/${doc.id}`);
            }
            else {
                toast({
                    title: "Failed to create document",
                    description: "The document was created but returned an invalid ID."
                });
            }
        },
        onError: (error) => {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Failed to create document",
                description: error instanceof Error ? error.message : "An unexpected error occurred"
            });
        }
    });

    return (
        <MotionFade>
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
                <div className="space-y-4">
                    <p className="text-muted-foreground">
                        Start by opening a note or
                    </p>
                    <Button
                        onClick={() => createDocument.mutate()}
                        disabled={createDocument.status === 'pending'}
                        variant="link"
                    >
                        Create a new one
                        <ArrowRight className="size-4" />
                    </Button>
                </div>
            </div>
        </MotionFade>
    )
} 