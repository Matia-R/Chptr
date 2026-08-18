"use client";

import * as React from "react";
import { PanelLeftClose, Plus, Search } from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter, usePathname } from "next/navigation";
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
import { HoverTooltip } from "~/app/_components/tooltip";
import { useCommandMenuStore } from "~/hooks/use-command-menu";
import { useUserProfile } from "~/hooks/use-user-profile";
import { markDocumentAsNew } from "~/hooks/use-new-document-flag";
import { cn, randomUUID } from "~/lib/utils";

const MOBILE_UTILITY_CONTROL_CLASSNAME = cn(
  "h-12 rounded-[10px] border border-sidebar-border/70 bg-sidebar-accent/45",
  "dark:border-white/10 dark:bg-[hsl(0_0%_22%_/_.95)]",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "active:bg-sidebar-accent active:text-sidebar-accent-foreground",
);

/** Quieter resting fill than `iconSubtle`; hover/press stay a bit stronger. */
const MOBILE_ICON_ACTION_CLASSNAME = cn(
  "size-8 shrink-0",
  "bg-foreground/[0.04]",
  "hover:bg-foreground/[0.12]",
  "active:bg-foreground/[0.16]",
);

/**
 * Desktop sidebar spacing — semantic, not optical.
 * Unrelated sections (Brand, Search, Documents) all use Tailwind `6`.
 * Heading-to-content is medium; peer rows are smallest.
 */
const DESKTOP_SIDEBAR = {
  /** Search defines this content width; Documents header matches it. */
  inset: "px-2",
  /** Brand → Search (unrelated sections). */
  sectionGap: "gap-6",
  /** Search → Documents (unrelated sections). */
  sectionStart: "pt-6",
  /** Documents heading → document list. */
  headingToContent: "pt-2",
} as const;

/** Interactive surface; gap is recovered from the previous 40px row. */
const DESKTOP_DOC_ROW_HEIGHT = 36;
const DESKTOP_DOC_ROW_GAP = 4;
const DESKTOP_DOC_ROW_STRIDE = DESKTOP_DOC_ROW_HEIGHT + DESKTOP_DOC_ROW_GAP;

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  initialDocuments: { id: string; name: string }[];
}

export function AppSidebar({ initialDocuments, ...props }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
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
    const newId = randomUUID();

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

  const renderAccount = (triggerClassName?: string) =>
    footerLoading ? (
      <NavUser isLoading triggerClassName={triggerClassName} />
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
        triggerClassName={triggerClassName}
      />
    ) : (
      <NavUser isLoading={false} triggerClassName={triggerClassName} />
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
          transform: "translateY(calc(var(--index) * var(--row-stride)))",
        } as React.CSSProperties
      }
    >
      <SidebarMenuButton
        asChild
        isActive={pathname === `/documents/${doc.id}`}
        className="h-9 data-[active=true]:font-normal"
      >
        <Link href={`/documents/${doc.id}`} prefetch={true}>
          <span className="truncate">{doc.name}</span>
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
          <div className="relative flex h-12 shrink-0 items-center px-4">
            <div className="font-lora text-2xl font-medium leading-none">
              Chptr
            </div>
            <Button
              variant="iconSubtle"
              size="icon"
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2",
                MOBILE_ICON_ACTION_CLASSNAME,
              )}
              aria-label="Search"
              onClick={openSearch}
            >
              <Search className="size-4" />
            </Button>
          </div>

          {/* Documents — collection header + new document */}
          <section className="flex min-h-0 flex-1 flex-col px-4 pt-5">
            <div className="flex h-8 shrink-0 items-center justify-between">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Documents
              </span>
              <Button
                variant="iconSubtle"
                size="icon"
                className={MOBILE_ICON_ACTION_CLASSNAME}
                aria-label="Create new document"
                onClick={handleCreateDocument}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden pt-2">
              {documentScroll(mobileDocumentList)}
            </div>
          </section>

          {/* Utility bar */}
          <div className="shrink-0 border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                {renderAccount(MOBILE_UTILITY_CONTROL_CLASSNAME)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  MOBILE_UTILITY_CONTROL_CLASSNAME,
                  "size-12 shrink-0",
                )}
                aria-label="Close navigation"
                onClick={dismissMobileNav}
              >
                <PanelLeftClose />
                <span className="sr-only">Close navigation</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <SidebarHeader
            className={cn(
              "pb-0",
              DESKTOP_SIDEBAR.inset,
              DESKTOP_SIDEBAR.sectionGap,
            )}
          >
            <div className="px-1 font-lora text-2xl font-medium">Chptr</div>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-9 w-full justify-between px-2.5 font-normal",
                "cursor-pointer bg-sidebar-accent/50 text-sidebar-foreground",
                "transition-[color,background-color,transform]",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "active:scale-[0.99] active:bg-sidebar-accent",
              )}
              onClick={() => setOpen(true)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Search className="size-4 shrink-0" aria-hidden />
                <span>Search</span>
              </span>
              <kbd className="shrink-0 text-xs font-normal text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </SidebarHeader>

          <section
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              DESKTOP_SIDEBAR.inset,
              DESKTOP_SIDEBAR.sectionStart,
            )}
          >
            <div className="flex h-8 shrink-0 items-center justify-between">
              <span className="text-sm font-semibold">Documents</span>
              <HoverTooltip content="New document" side="right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="New document"
                  onClick={handleCreateDocument}
                >
                  <Plus className="size-4" />
                </Button>
              </HoverTooltip>
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-hidden",
                DESKTOP_SIDEBAR.headingToContent,
              )}
            >
              {documentScroll(
                <SidebarContent className="gap-0 overflow-hidden p-0">
                  <SidebarGroup className="p-0">
                    <SidebarMenu
                      className="relative gap-0"
                      style={
                        {
                          "--item-count": documents?.documents?.length ?? 0,
                          "--row-stride": `${DESKTOP_DOC_ROW_STRIDE}px`,
                          height:
                            "calc(var(--item-count) * var(--row-stride))",
                        } as React.CSSProperties
                      }
                    >
                      {desktopDocumentList}
                    </SidebarMenu>
                  </SidebarGroup>
                </SidebarContent>,
              )}
            </div>
          </section>

          <div className="flex-none">
            <SidebarFooter>{renderAccount()}</SidebarFooter>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
