"use client"

import * as React from "react"
import { FileText, Plus } from "lucide-react"
import { api } from "~/trpc/react"
import { useRouter } from "next/navigation"

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
type DocumentMenuButtonProps = { id: string; name: string }

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  documents: DocumentMenuButtonProps[]
}

export function AppSidebar({ documents, ...props }: AppSidebarProps) {
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
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">My Documents</span>
                </div>
              </a>
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
              disabled={status === 'pending'}
            >
              <Plus className="size-4" />
              New Document
            </Button>
          </div>
          <SidebarMenu className="gap-2">
            {documents.map((doc) => (
              <SidebarMenuItem key={doc.id}>
                <SidebarMenuButton asChild>
                  <a href={`/documents/${doc.id}`}>
                    {doc.name}
                  </a>
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
