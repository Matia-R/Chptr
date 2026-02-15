"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { BreadcrumbItem, Breadcrumb, BreadcrumbList } from "./breadcrumb";
import { useState } from "react";
import * as React from "react";
import { cn } from "~/lib/utils";
import { useToast } from "../../hooks/use-toast";
import { SquarePen, X } from "lucide-react";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";

export function DocumentBreadcrumb() {
  const params = useParams();
  const documentId = params.documentId as string;
  const { isNew, clearFlag } = useNewDocumentFlag();
  const utils = api.useUtils();
  const { toast } = useToast();

  // Don't fetch document data for new documents - show "Untitled" optimistically
  const { data: document, isLoading } = api.document.getDocumentById.useQuery(
    documentId,
    {
      enabled: !!documentId && !isNew,
    },
  );

  // Track the previous name for reverting on error
  const previousNameRef = React.useRef<string>("Untitled");

  const updateName = api.document.updateDocumentName.useMutation({
    onError: (err) => {
      // Revert to the previous name
      setEditingName(previousNameRef.current);

      toast({
        variant: "destructive",
        title: "Failed to update document name",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    },
    onSettled: () => {
      void utils.document.getDocumentIdsForAuthenticatedUser.invalidate();
      void utils.document.getDocumentById.invalidate(documentId);
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("Untitled");

  // Sync editingName with document data or reset for new documents
  React.useEffect(() => {
    if (document?.document?.name) {
      // Existing document loaded - use its name
      setEditingName(document.document.name);
    } else if (isNew) {
      // New document - use "Untitled"
      setEditingName("Untitled");
    } else {
      // Existing document loading - reset to empty (skeleton will show)
      setEditingName("");
    }
  }, [documentId, document?.document?.name, isNew]);

  const handleSave = () => {
    const trimmedName = editingName.trim();
    const currentName = document?.document?.name ?? "Untitled";

    // If no valid name or no change, just cancel
    if (!trimmedName || trimmedName === currentName) {
      handleCancel();
      return;
    }

    // Store the previous name for potential revert
    previousNameRef.current = currentName;

    // Clear the "new" flag when user changes the name
    if (isNew) {
      clearFlag();
    }

    // Optimistically update the input immediately
    setEditingName(trimmedName);

    // Optimistically update the documents list (add if new, update if exists)
    utils.document.getDocumentIdsForAuthenticatedUser.setData(
      undefined,
      (old) => {
        if (!old?.documents) {
          // No documents yet - create the list with this one
          return {
            success: true,
            documents: [{ id: documentId, name: trimmedName }],
          };
        }

        const exists = old.documents.some((doc) => doc.id === documentId);
        if (exists) {
          // Update existing
          return {
            ...old,
            documents: old.documents.map((doc) =>
              doc.id === documentId ? { ...doc, name: trimmedName } : doc,
            ),
          };
        } else {
          // Add new document to list
          return {
            ...old,
            documents: [
              { id: documentId, name: trimmedName },
              ...old.documents,
            ],
          };
        }
      },
    );

    updateName.mutate({ id: documentId, name: trimmedName });
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Revert to the current document name (or "Untitled" for new docs)
    setEditingName(document?.document?.name ?? "Untitled");
    setIsEditing(false);
  };

  const sharedStyles =
    "w-[200px] py-1 px-2 rounded-sm text-sm text-foreground font-semibold outline-none";

  // Show loading skeleton only for existing documents that are loading
  if (isLoading && !isNew) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="md:block">
            <div className={cn(sharedStyles, "h-4 animate-pulse bg-accent")} />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Use editingName for display - it's kept in sync with document name
  // and updated optimistically when user saves
  const displayName = editingName || "Untitled";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="md:block">
          <div className="group relative">
            {isEditing ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingName(e.target.value)
                  }
                  onBlur={handleSave}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      handleSave();
                    }
                    if (e.key === "Escape") {
                      handleCancel();
                    }
                  }}
                  className={cn(
                    sharedStyles,
                    "bg-transparent pr-8 outline-none",
                    "truncate focus:bg-accent focus:text-accent-foreground",
                  )}
                  autoFocus
                />
                <button
                  onMouseDown={(e) => {
                    // Prevent the input's onBlur from firing
                    e.preventDefault();
                  }}
                  onClick={handleCancel}
                  className="absolute right-1 rounded-sm p-1 hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    sharedStyles,
                    "truncate pr-8 text-left hover:bg-accent hover:text-accent-foreground",
                  )}
                  title={displayName}
                >
                  {displayName}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute right-1 rounded-sm p-1 opacity-0 hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
