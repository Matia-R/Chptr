'use client'

import { Button } from "../_components/button";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { type Document } from "~/server/api/routers/document";

export default function DocumentsPage() {
    const router = useRouter();
    const createDocument = api.document.createDocument.useMutation({
        onSuccess: (data) => {
            const doc = data.createdDocument[0] as Document;
            if (doc?.id) {
                router.push(`/documents/${doc.id}`);
            }
        }
    });

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold">Documents</h1>
            <Button onClick={() => createDocument.mutate()}>
                New Document
            </Button>
        </div>
    );
}
