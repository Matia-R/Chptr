"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { MoreVertical } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Skeleton } from "./skeleton";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";

export function DocumentActions() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { isNew } = useNewDocumentFlag();

  // Don't fetch for new documents
  const { data, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && !isNew,
    },
  );

  const renderContent = () => {
    // For new documents, show "No changes yet"
    if (isNew) {
      return <span>No changes yet</span>;
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-1">
          <span>Edited</span>
          <Skeleton className="h-4 w-24" />
        </div>
      );
    }

    if (!data?.document?.last_updated) {
      return <span>No changes yet</span>;
    }

    const lastUpdated = new Date(data.document.last_updated);
    const now = new Date();

    const monthDay = lastUpdated.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    const dateStr =
      lastUpdated.getFullYear() === now.getFullYear()
        ? monthDay
        : `${monthDay}, ${lastUpdated.getFullYear()}`;

    return <span>Edited {dateStr}</span>;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {renderContent()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
