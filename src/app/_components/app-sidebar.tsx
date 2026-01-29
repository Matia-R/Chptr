"use client";

import * as React from "react";
import { Home, Plus, Search } from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ScrollArea } from "~/app/_components/scroll-area";

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
} from "~/app/_components/sidebar";
import { Button } from "./button";
import { type Document } from "~/server/api/routers/document";
import { useToast } from "../../hooks/use-toast";
import { NavUser } from "./nav-user";
import { useCommandMenuStore } from "~/hooks/use-command-menu";
import { useUserProfile } from "~/hooks/use-user-profile";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialDocuments: { id: string; name: string }[];
}

export function AppSidebar({ initialDocuments, ...props }: AppSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const currentDocumentId = params.documentId as string;
  const utils = api.useUtils();
  const { toast } = useToast();
  const setOpen = useCommandMenuStore((state) => state.setOpen);
  const { isMobile, setOpenMobile } = useSidebar();

  // State to track scroll position for shadow indicators
  const [showTopShadow, setShowTopShadow] = React.useState(false);
  const [showBottomShadow, setShowBottomShadow] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Handle scroll events to detect when user is not at top or bottom
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      setShowTopShadow(target.scrollTop > 0);
      setShowBottomShadow(
        target.scrollTop + target.clientHeight < target.scrollHeight - 1,
      );
    },
    [],
  );

  // Use TRPC query to keep documents in sync
  const { data: documents } =
    api.document.getDocumentIdsForAuthenticatedUser.useQuery(undefined, {
      initialData: { success: true, documents: initialDocuments },
      refetchOnMount: true,
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
          utils.document.getDocumentById.prefetch(doc.id),
        ]);
        router.push(`/documents/${doc.id}`);
      } else {
        toast({
          title: "Failed to create document",
          description: "The document was created but returned an invalid ID.",
        });
      }
    },
    onError: (error) => {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Failed to create document",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    },
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
    <Sidebar variant="inset" {...props}>
      <div className="flex h-full flex-col">
        <div className="flex-none">
          <SidebarHeader className="pb-0">
            <div className="font-lora px-1 text-2xl font-medium">Chptr</div>
            <div className="py-6">
              <div className="space-y-2">
                <Button
                  className="h-9 w-full justify-between gap-2 px-2"
                  variant="ghost"
                  onClick={() => setOpen(true)}
                >
                  <div className="flex items-center gap-2">
                    <Search className="size-4" />
                    <span className="text-sm">Search</span>
                  </div>
                  <span className="text-xs text-muted-foreground">⌘K</span>
                </Button>
                <Button
                  className="h-9 w-full justify-start gap-2 px-2"
                  variant="ghost"
                  asChild
                >
                  <Link href="/documents">
                    <Home className="size-4" />
                    <span className="text-sm">Home</span>
                  </Link>
                </Button>
              </div>
            </div>
          </SidebarHeader>
          <SidebarHeader className="pt-0">
            <div className="flex items-center justify-between px-2 text-sm font-semibold">
              <span>Recents</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => createDocument.mutate()}
                disabled={createDocument.status === "pending"}
              >
                <Plus className="size-4" />
              </Button>
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
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 border-t bg-gradient-to-b from-border/20 to-transparent" />
              )}
              {showBottomShadow && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 border-b bg-gradient-to-t from-border/20 to-transparent" />
              )}
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu>
                    <div
                      className="relative"
                      style={
                        {
                          "--item-count": documents?.documents?.length ?? 0,
                          height: "calc(var(--item-count) * 48px)",
                        } as React.CSSProperties
                      }
                    >
                      {documents?.documents?.map((doc, index) => (
                        <SidebarMenuItem
                          key={doc.id}
                          className={`ease-[cubic-bezier(0.4,0,0.2,1)] absolute inset-x-0 top-0 transform transition-transform duration-300`}
                          style={
                            {
                              "--index": index,
                              transform:
                                "translateY(calc(var(--index) * 48px))",
                            } as React.CSSProperties
                          }
                        >
                          <SidebarMenuButton asChild>
                            <Link
                              href={`/documents/${doc.id}`}
                              prefetch={true}
                              onClick={() => {
                                void utils.document.getDocumentById.invalidate(
                                  doc.id,
                                );
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
                  default_avatar_background_color:
                    userProfile.default_avatar_background_color,
                }}
              />
            ) : (
              <NavUser isLoading={userLoading} />
            )}
          </SidebarFooter>
        </div>
      </div>
    </Sidebar>
  );
}
