"use client"

import * as React from "react"
import { FileText, Plus } from "lucide-react"
import { api } from "~/trpc/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/app/_components/sidebar"
import { Button } from "./button"
import { type Document } from "~/server/api/routers/document"
import { ThemeToggle } from "./theme-toggle"
import { useToast } from "../../hooks/use-toast"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialDocuments: { id: string; name: string }[]
}

export function AppSidebar({ initialDocuments, ...props }: AppSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const currentDocumentId = params.documentId as string;
  const utils = api.useUtils();
  const { toast } = useToast();

  // Use TRPC query to keep documents in sync
  const { data: documents } = api.document.getDocumentIdsForAuthenticatedUser.useQuery(undefined, {
    initialData: { success: true, documents: initialDocuments },
    refetchOnMount: true
  });

  const createDocument = api.document.createDocument.useMutation({
    onSuccess: async (data) => {
      const doc = data.createdDocument[0] as Document;
      if (doc?.id) {
        // Invalidate both the document list and the new document
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

  // Setup document data prefetching
  React.useEffect(() => {
    documents?.documents?.forEach((doc) => {
      // Always prefetch the document data
      void utils.document.getDocumentById.prefetch(doc.id);

      // If this is the current document, set up periodic revalidation
      if (doc.id === currentDocumentId) {
        const interval = setInterval(() => {
          void utils.document.getDocumentById.invalidate(doc.id);
        }, 30000); // Revalidate every 30 seconds

        return () => clearInterval(interval);
      }
    });
  }, [documents?.documents, utils, currentDocumentId]);

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/documents">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">My Documents</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-2 mb-2">
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              onClick={() => createDocument.mutate()}
              disabled={createDocument.status === 'pending'}
            >
              <Plus className="size-4" />
              New Document
            </Button>
          </div>
          <SidebarMenu className="gap-2">
            {documents?.documents?.map((doc) => (
              <SidebarMenuItem key={doc.id}>
                <SidebarMenuButton asChild>
                  <Link
                    href={`/documents/${doc.id}`}
                    prefetch={true}
                    onClick={() => {
                      // Invalidate the cache when navigating to ensure fresh data
                      void utils.document.getDocumentById.invalidate(doc.id);
                    }}
                  >
                    {doc.name}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <ThemeToggle />
      </SidebarContent>
    </Sidebar>
  )
}
