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

export function NavUser({
  user,
  isLoading,
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
}) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

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
          <SidebarMenuButton size="lg">
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
          <div className="px-4 py-2 text-sm text-muted-foreground">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              {theme === "dark" ? "Light" : "Dark"} mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
