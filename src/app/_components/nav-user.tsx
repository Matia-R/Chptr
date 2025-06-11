"use client"

import {
  BadgeCheck,
  // Bell,
  ChevronsUpDown,
  // CreditCard,
  LogOut,
  // Sparkles,
  Moon,
  Sun,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "~/app/_components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/app/_components/sidebar"
import { useTheme } from "next-themes"
import { cn } from "~/lib/utils"
import { useRouter } from "next/navigation"
import { createClient } from "~/utils/supabase/client"
import { Skeleton } from "~/app/_components/skeleton"

export function NavUser({
  user,
  isLoading,
}: {
  user?: {
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
    default_avatar_background_color: string
  }
  isLoading?: boolean
}) {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1 text-left text-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="px-4 py-2 text-sm text-muted-foreground">User not found</div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const initials = `${user.first_name[0]}${user.last_name[0]}`

  // string formatting is problematic with tailwind classes, so we use an object to store the colors
  const fallbackAvatarBackgroundColors = {
    blue: "bg-blue-400",
    green: "bg-green-400",
    red: "bg-red-400",
    yellow: "bg-yellow-400",
    purple: "bg-purple-400",
    pink: "bg-pink-400",
    indigo: "bg-indigo-400"
  }


  const fallbackAvatarBackgroundClass = fallbackAvatarBackgroundColors[user.default_avatar_background_color as keyof typeof fallbackAvatarBackgroundColors] ?? "bg-blue-500"

  console.log(fallbackAvatarBackgroundClass)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} />
                ) : (
                  <AvatarFallback className={cn("rounded-lg text-black", fallbackAvatarBackgroundClass)}>
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{`${user.first_name} ${user.last_name}`}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} />
                  ) : (
                    <AvatarFallback className={cn("rounded-lg text-black", fallbackAvatarBackgroundClass)}>
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{`${user.first_name} ${user.last_name}`}</span>
                  <span className="truncate text-xs">{user.email}</span>
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
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
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
  )
}
