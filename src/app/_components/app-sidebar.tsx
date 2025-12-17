"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { api } from "~/trpc/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ScrollArea } from "~/app/_components/scroll-area"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "~/app/_components/sidebar"
import { Button } from "./button"
import { type Document } from "~/server/api/routers/document"
import { useToast } from "../../hooks/use-toast"
import { NavUser } from "./nav-user"
import { useCommandMenuStore } from "~/hooks/use-command-menu"
import { useUserProfile } from "~/hooks/use-user-profile"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialDocuments: { id: string; name: string }[]
}

export function AppSidebar({ initialDocuments, ...props }: AppSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const currentDocumentId = params.documentId as string;
  const utils = api.useUtils();
  const { toast } = useToast();
  const setOpen = useCommandMenuStore((state) => state.setOpen)
  const { isMobile, setOpenMobile } = useSidebar();

  // State to track scroll position for shadow indicators
  const [showTopShadow, setShowTopShadow] = React.useState(false);
  const [showBottomShadow, setShowBottomShadow] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Handle scroll events to detect when user is not at top or bottom
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setShowTopShadow(target.scrollTop > 0);
    setShowBottomShadow(target.scrollTop + target.clientHeight < target.scrollHeight - 1);
  }, []);

  // Use TRPC query to keep documents in sync
  const { data: documents } = api.document.getDocumentIdsForAuthenticatedUser.useQuery(undefined, {
    initialData: { success: true, documents: initialDocuments },
    refetchOnMount: true
  });

  // Ensure shadow state is correct on mount and when content changes
  React.useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    setShowTopShadow(el.scrollTop > 0);
    setShowBottomShadow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, [documents]);

  // Fetch user profile and email (shared query, automatically deduplicated by React Query)
  const { data: userProfile, isLoading: userLoading } = useUserProfile();
  const { data: userEmail } = api.user.getCurrentUser.useQuery();

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
    <Sidebar variant="sidebar" {...props}>
      <div className="flex h-full flex-col">
        <div className="flex-none">
          <SidebarHeader>
            <div className="font-semibold text-xl font-sans px-1">Chptr</div>
            <div className="pt-2">
              <div className="mb-2">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  onClick={() => createDocument.mutate()}
                  disabled={createDocument.status === 'pending'}
                >
                  <Plus className="size-4" />
                  New
                </Button>
              </div>
            </div>
          </SidebarHeader>
          <SidebarHeader>
            <div className="px-2 text-sm font-semibold flex items-center justify-between">
              <span>Notes</span>
              <button
                onClick={() => setOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors data-[highlight=true]:text-foreground focus-visible:ring-1 focus-visible:ring-ring outline-none"
                data-highlight="false"
                data-search-button
              >
                Search ⌘K
              </button>
            </div>
          </SidebarHeader>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="relative h-full">
            <ScrollArea
              className="h-full"
              ref={scrollAreaRef}
              onScroll={handleScroll}
            >
              {showTopShadow && (
                <div className="border-t absolute pointer-events-none inset-x-0 top-0 h-4 bg-gradient-to-b from-border/20 to-transparent z-10" />
              )}
              {showBottomShadow && (
                <div className="border-b absolute pointer-events-none inset-x-0 bottom-0 h-4 bg-gradient-to-t from-border/20 to-transparent z-10" />
              )}
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu>
                    <div
                      className="relative"
                      style={{
                        '--item-count': documents?.documents?.length ?? 0,
                        height: 'calc(var(--item-count) * 48px)'
                      } as React.CSSProperties}
                    >
                      {documents?.documents?.map((doc, index) => (
                        <SidebarMenuItem
                          key={doc.id}
                          className={`absolute inset-x-0 top-0 transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`}
                          style={{
                            '--index': index,
                            transform: 'translateY(calc(var(--index) * 48px))'
                          } as React.CSSProperties}
                        >
                          <SidebarMenuButton asChild>
                            <Link
                              href={`/documents/${doc.id}`}
                              prefetch={true}
                              onClick={() => {
                                void utils.document.getDocumentById.invalidate(doc.id);
                                if (isMobile) {
                                  setOpenMobile(false);
                                }
                              }}
                            >
                              {doc.name}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </div>
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-none">
          <SidebarFooter>
            {userProfile && userEmail ? (
              <NavUser
                user={{
                  first_name: userProfile.first_name,
                  last_name: userProfile.last_name,
                  email: userEmail,
                  avatar_url: userProfile.avatar_url,
                  default_avatar_background_color: userProfile.default_avatar_background_color,
                }}
              />
            ) : (
              <NavUser isLoading={userLoading} />
            )}
          </SidebarFooter>
        </div>
      </div>
    </Sidebar>
  )
}
