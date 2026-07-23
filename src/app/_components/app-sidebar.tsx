"use client";

import * as React from "react";
import { Home, PanelLeftClose, Plus, Search } from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
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
import { NavUser } from "./nav-user";
import { MobileActionGroup } from "./mobile-action-rows";
import { useCommandMenuStore } from "~/hooks/use-command-menu";
import { useUserProfile } from "~/hooks/use-user-profile";
import { markDocumentAsNew } from "~/hooks/use-new-document-flag";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialDocuments: { id: string; name: string }[];
}

const DESKTOP_DOC_ROW_HEIGHT = 48;

export function AppSidebar({ initialDocuments, ...props }: AppSidebarProps) {
  const router = useRouter();
  const utils = api.useUtils();
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

  const { data: userProfile, isLoading: userLoading } = useUserProfile();
  const { data: userEmail, isLoading: emailLoading } =
    api.user.getCurrentUser.useQuery();

  const footerLoading =
    userLoading || (!!userProfile && !userProfile.username && emailLoading);

  const dismissMobileNav = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  // Instant document creation with optimistic sidebar update
  const handleCreateDocument = React.useCallback(() => {
    const newId = crypto.randomUUID();

    // Mark as new for the document page
    markDocumentAsNew(newId);

    // Optimistically add to sidebar list
    utils.document.getDocumentIdsForAuthenticatedUser.setData(
      undefined,
      (old) => {
        if (!old?.documents) return old;
        // Add new doc at the beginning of the list
        return {
          ...old,
          documents: [{ id: newId, name: "Untitled" }, ...old.documents],
        };
      },
    );

    dismissMobileNav();
    router.push(`/documents/${newId}`);
  }, [dismissMobileNav, router, utils]);

  const openSearch = React.useCallback(() => {
    dismissMobileNav();
    setOpen(true);
  }, [dismissMobileNav, setOpen]);

  const account = footerLoading ? (
    <NavUser isLoading />
  ) : userProfile ? (
    <NavUser
      user={{
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        username: userProfile.username,
        email: userEmail ?? "",
        avatar_url: userProfile.avatar_url,
        default_avatar_background_color:
          userProfile.default_avatar_background_color,
      }}
    />
  ) : (
    <NavUser isLoading={false} />
  );

  const mobileDocumentList = (
    <div className="flex flex-col">
      {documents?.documents?.map((doc) => (
        <Button
          key={doc.id}
          variant="ghost"
          asChild
          className="h-auto min-h-12 w-full justify-start px-3 py-3 text-left text-[15px] font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent"
        >
          <Link
            href={`/documents/${doc.id}`}
            prefetch={true}
            onClick={dismissMobileNav}
          >
            <span className="min-w-0 flex-1 truncate">{doc.name}</span>
          </Link>
        </Button>
      ))}
    </div>
  );

  const desktopDocumentList = documents?.documents?.map((doc, index) => (
    <SidebarMenuItem
      key={doc.id}
      className="ease-[cubic-bezier(0.4,0,0.2,1)] absolute inset-x-0 top-0 transform transition-transform duration-300"
      style={
        {
          "--index": index,
          transform: "translateY(calc(var(--index) * var(--row-height)))",
        } as React.CSSProperties
      }
    >
      <SidebarMenuButton asChild>
        <Link href={`/documents/${doc.id}`} prefetch={true}>
          {doc.name}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  const documentScroll = (list: React.ReactNode) => (
    <div className="relative h-full min-h-0">
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
        {list}
      </ScrollArea>
    </div>
  );

  return (
    <Sidebar variant="inset" {...props}>
      {isMobile ? (
        <div
          className="flex h-full min-h-0 flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
          }}
        >
          {/* Header — match document layout header height (h-12) */}
          <div className="flex h-12 shrink-0 items-center justify-between px-4">
            <div className="font-lora text-2xl font-medium leading-none">
              Chptr
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Close navigation"
              onClick={dismissMobileNav}
            >
              <PanelLeftClose />
              <span className="sr-only">Close navigation</span>
            </Button>
          </div>

          {/* Search + Home — equal spacing between logo and Documents */}
          <div className="flex shrink-0 flex-col gap-0.5 px-3 py-3">
            <Button
              className="h-10 w-full justify-start gap-2 px-3 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent"
              variant="ghost"
              onClick={openSearch}
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="text-sm">Search</span>
            </Button>
            <Button
              variant="ghost"
              asChild
              className="h-10 w-full justify-start gap-2 px-3 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent"
            >
              <Link href="/documents" onClick={dismissMobileNav}>
                <Home className="size-4 shrink-0" aria-hidden />
                <span className="text-sm">Home</span>
              </Link>
            </Button>
          </div>

          {/* Documents — primary content */}
          <section className="flex min-h-0 flex-1 flex-col px-3">
            <div className="flex shrink-0 items-center justify-between px-1 pb-2">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Documents
              </span>
              <Button
                variant="iconSubtle"
                size="icon"
                aria-label="Create new document"
                onClick={handleCreateDocument}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {documentScroll(mobileDocumentList)}
            </div>
          </section>

          {/* Account — pinned bottom group */}
          <div className="shrink-0 px-3 pb-3 pt-3">
            <MobileActionGroup className="p-1">{account}</MobileActionGroup>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex-none">
            <SidebarHeader className="pb-0">
              <div className="px-1 font-lora text-2xl font-medium">Chptr</div>
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
                  variant="iconSubtle"
                  size="icon"
                  className="size-8"
                  aria-label="Create new document"
                  onClick={handleCreateDocument}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </SidebarHeader>
          </div>

          <div className="flex-1 overflow-hidden">
            {documentScroll(
              <SidebarContent>
                <SidebarGroup>
                  <SidebarMenu
                    className="relative gap-0"
                    style={
                      {
                        "--item-count": documents?.documents?.length ?? 0,
                        "--row-height": `${DESKTOP_DOC_ROW_HEIGHT}px`,
                        height: "calc(var(--item-count) * var(--row-height))",
                      } as React.CSSProperties
                    }
                  >
                    {desktopDocumentList}
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>,
            )}
          </div>

          <div className="flex-none">
            <SidebarFooter>{account}</SidebarFooter>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
