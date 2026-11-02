"use client"

import { useRouter } from "next/navigation"
import {
  ChevronsUpDownIcon,
  KeyRoundIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { RAIL_BUTTON } from "@/components/app-sidebar-styles"
import { useClaims, useSession } from "@/components/session-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function UserMenu() {
  const claims = useClaims()
  const { signOut } = useSession()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  const name =
    [claims.first_name, claims.last_name].filter(Boolean).join(" ") ||
    claims.username
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className={cn("data-popup-open:bg-sidebar-accent", RAIL_BUTTON)}
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {claims.role_text ?? claims.email}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="end" side="top" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="grid gap-0.5">
                <span className="text-foreground">{name}</span>
                {claims.email && (
                  <span className="font-normal">{claims.email}</span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/personal-data")}>
                <UserIcon />
                Personal data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/password")}>
                <KeyRoundIcon />
                Change password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                signOut()
                router.replace("/login")
              }}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
