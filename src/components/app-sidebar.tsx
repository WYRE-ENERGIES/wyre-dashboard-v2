"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ActivityIcon,
  BellIcon,
  FileTextIcon,
  FuelIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SunIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import { RAIL_BUTTON } from "@/components/app-sidebar-styles"
import { BranchSwitcher } from "@/components/branch-switcher"
import { useClaims } from "@/components/session-provider"
import { UserMenu } from "@/components/user-menu"
import { WyreLogo } from "@/components/wyre-logo"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { visibleNav, type NavKey } from "@/lib/gating"

type NavItem = { key: NavKey; title: string; href: string; icon: LucideIcon; ready: boolean }

// `ready: false` items are listed so the structure is visible, but are not
// built yet in this first slice of the rebuild.
const NAV: NavItem[] = [
  { key: "dashboard", title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon, ready: true },
  { key: "diesel", title: "Diesel Overview", href: "/diesel-overview", icon: FuelIcon, ready: false },
  { key: "solar", title: "Solar Overview", href: "/solar-overview", icon: SunIcon, ready: false },
  { key: "parameters", title: "Parameters", href: "/parameters", icon: ActivityIcon, ready: false },
  { key: "score-card", title: "Score Card", href: "/score-card", icon: GaugeIcon, ready: false },
  { key: "cost-tracker", title: "Cost Tracker", href: "/cost-tracker", icon: WalletIcon, ready: false },
  { key: "billing", title: "Billing", href: "/billing", icon: ReceiptIcon, ready: false },
  { key: "report", title: "Report", href: "/report", icon: FileTextIcon, ready: false },
  { key: "alerts", title: "Alerts and Alarms", href: "/alerts-and-alarms", icon: BellIcon, ready: false },
]

export function AppSidebar() {
  const claims = useClaims()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const visible = visibleNav(claims)
  // Carry the global period across pages.
  const query = searchParams.toString()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex h-8 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <WyreLogo className="h-7 text-primary" />
        </div>
        <BranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{claims.client}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {NAV.filter((item) => visible.has(item.key)).map((item) => (
                <SidebarMenuItem key={item.key}>
                  {item.ready ? (
                    <SidebarMenuButton
                      className={RAIL_BUTTON}
                      tooltip={item.title}
                      isActive={pathname.startsWith(item.href)}
                      render={<Link href={query ? `${item.href}?${query}` : item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton className={RAIL_BUTTON} tooltip={`${item.title} (coming soon)`} disabled>
                      <item.icon />
                      <span>{item.title}</span>
                      <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">
                        Soon
                      </Badge>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
