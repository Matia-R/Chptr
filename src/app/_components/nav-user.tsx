"use client";

import {
  BadgeCheck,
  // Bell,
  ChevronsUpDown,
  // CreditCard,
  LogOut,
  // Sparkles,
  Moon,
  Sun,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { UserAvatar } from "~/app/_components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/app/_components/sidebar";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { createClient } from "~/utils/supabase/client";
import { Skeleton } from "~/app/_components/skeleton";
import { useAccountSettingsStore } from "~/hooks/use-account-settings";
import { cn } from "~/lib/utils";

export function NavUser({
  user,
  isLoading,
  triggerClassName,
}: {
  user?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email: string;
    avatar_url: string | null;
    default_avatar_background_color: string;
  };
  isLoading?: boolean;
  triggerClassName?: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const openAccountSettings = useAccountSettingsStore((state) => state.open);

  // On mobile the nav itself is a drawer; dismiss it before opening the
  // settings drawer so the two don't stack.
  const handleOpenAccountSettings = () => {
    openAccountSettings();
    if (isMobile) {
      // Defer so the account drawer can mount before the nav sheet tears down —
      // closing synchronously lets the same tap fall through to the page.
      window.setTimeout(() => setOpenMobile(false), 0);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear all cached server state so the next user doesn't see the previous user's data
    queryClient.clear();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className={triggerClassName}>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="grid flex-1 gap-1 text-left text-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            className={cn(
              "px-4 py-2 text-sm text-muted-foreground",
              triggerClassName,
            )}
          >
            User not found
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const subtitle = user.username
    ? `@${user.username}`
    : user.email
      ? user.email
      : null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/*
         * Desktop stays non-modal: a modal menu + the account Dialog corrupt
         * Radix's shared body pointer-events bookkeeping. Mobile uses a Vaul
         * drawer instead, and needs modal so the menu sits above the nav sheet
         * and actually receives hover/clicks.
         */}
        <DropdownMenu modal={isMobile}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                triggerClassName,
              )}
            >
              <UserAvatar
                first_name={user.first_name}
                last_name={user.last_name}
                avatar_url={user.avatar_url}
                default_avatar_background_color={
                  user.default_avatar_background_color
                }
                alt={`${user.first_name} ${user.last_name}`}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{`${user.first_name} ${user.last_name}`}</span>
                {subtitle ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                ) : null}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-sidebar"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  first_name={user.first_name}
                  last_name={user.last_name}
                  avatar_url={user.avatar_url}
                  default_avatar_background_color={
                    user.default_avatar_background_color
                  }
                  alt={`${user.first_name} ${user.last_name}`}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{`${user.first_name} ${user.last_name}`}</span>
                  {subtitle ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup> */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground"
                onSelect={handleOpenAccountSettings}
              >
                <BadgeCheck />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              {theme === "dark" ? "Light" : "Dark"} mode
            </DropdownMenuItem>
            <DropdownMenuItem
              className="data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-sidebar-accent-foreground"
              onClick={handleSignOut}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
