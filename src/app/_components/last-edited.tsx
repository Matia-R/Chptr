'use client';

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";

export function LastEdited() {
    const params = useParams();
    const documentId = params.documentId as string;
    const { data } = api.document.getDocumentById.useQuery(documentId, {
        enabled: !!documentId
    });

    if (!data?.document?.last_updated) {
        return null;
    }

    const lastUpdated = new Date(data.document.last_updated);
    const now = new Date();

    const monthDay = lastUpdated.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
    });

    const dateStr = lastUpdated.getFullYear() === now.getFullYear()
        ? monthDay
        : `${monthDay}, ${lastUpdated.getFullYear()}`;

    return (
        <div className="text-sm text-muted-foreground px-2">
            Edited {dateStr}
        </div>
    );
} 