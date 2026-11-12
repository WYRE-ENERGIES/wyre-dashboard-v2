"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ActivityIcon,
  BellIcon,
  ChartPieIcon,
  ChevronRightIcon,
  FileTextIcon,
  FuelIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SunIcon,
  ToggleRightIcon,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useCloseOnMobile } from "@/components/use-close-on-mobile"
import { visibleNav, type NavKey } from "@/lib/gating"
import { useSidebarStyle } from "@/lib/sidebar-style"
import { cn } from "@/lib/utils"

type NavLink = { title: string; href: string; ready: boolean }
type Section = "Monitor" | "Analyse" | "Manage"
type NavItem = NavLink & {
  key: NavKey
  icon: LucideIcon
  /** Heading the item sits under in the grouped sidebar styles. */
  section: Section
  children?: NavLink[]
}

const SECTIONS: Section[] = ["Monitor", "Analyse", "Manage"]

// Paths match the old app so bookmarks and email links keep working.
// `ready: false` items show a "Soon" badge until their page is rebuilt.
const NAV: NavItem[] = [
  {
    key: "dashboard",
    section: "Monitor",
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    ready: true,
  },
  {
    key: "load-overview",
    section: "Monitor",
    title: "Load Overview",
    href: "/load-overview",
    icon: ChartPieIcon,
    ready: true,
  },
  {
    key: "diesel",
    section: "Monitor",
    title: "Diesel Overview",
    href: "/diesel-overview",
    icon: FuelIcon,
    ready: true,
  },
  {
    key: "solar",
    section: "Monitor",
    title: "Solar Overview",
    href: "/solar-overview",
    icon: SunIcon,
    ready: true,
  },
  {
    key: "parameters",
    section: "Monitor",
    title: "Parameters",
    href: "/parameters/energy-consumption",
    icon: ActivityIcon,
    ready: true,
    children: [
      {
        title: "Energy Consumption",
        href: "/parameters/energy-consumption",
        ready: true,
      },
      {
        title: "Power Quality",
        href: "/parameters/power-quality",
        ready: true,
      },
      { title: "Power Demand", href: "/parameters/power-demand", ready: true },
      { title: "Last Reading", href: "/parameters/last-reading", ready: true },
      { title: "Time of Use", href: "/parameters/time-of-use", ready: true },
    ],
  },
  {
    key: "score-card",
    section: "Analyse",
    title: "Score Card",
    href: "/score-card",
    icon: GaugeIcon,
    ready: true,
  },
  {
    key: "cost-tracker",
    section: "Analyse",
    title: "Cost Tracker",
    href: "/cost-tracker",
    icon: WalletIcon,
    ready: true,
  },
  {
    key: "billing",
    section: "Analyse",
    title: "Billing",
    href: "/billing",
    icon: ReceiptIcon,
    ready: true,
  },
  {
    key: "report",
    section: "Analyse",
    title: "Report",
    href: "/report",
    icon: FileTextIcon,
    ready: true,
  },
  {
    key: "alerts",
    section: "Manage",
    title: "Alerts and Alarms",
    href: "/alerts-and-alarms",
    icon: BellIcon,
    ready: true,
  },
  {
    key: "breakers",
    section: "Manage",
    title: "Breakers",
    href: "/breakers",
    icon: ToggleRightIcon,
    ready: true,
  },
]

function SoonBadge() {
  return (
    <Badge
      variant="secondary"
      className="ml-auto group-data-[collapsible=icon]:hidden"
    >
      Soon
    </Badge>
  )
}

export function AppSidebar() {
  const claims = useClaims()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const style = useSidebarStyle()
  const closeOnMobile = useCloseOnMobile()
  const visible = visibleNav(claims)
  // Carry the global period across pages.
  const query = searchParams.toString()
  const withQuery = (href: string) => (query ? `${href}?${query}` : href)
  const items = NAV.filter((item) => visible.has(item.key))
  // Grouped styles split the menu into sections; the others list it flat
  // under the organisation's name.
  const groups = style.grouped
    ? SECTIONS.map((section) => ({
        label: section,
        items: items.filter((item) => item.section === section),
      })).filter((group) => group.items.length > 0)
    : [{ label: claims.client, items }]
  const darkSidebar = style.value === "classic" || style.value === "ink"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex h-8 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <WyreLogo
            className={cn("h-7", darkSidebar ? "text-white" : "text-brand")}
          />
        </div>
        <BranchSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                {group.items.map((item) =>
                  item.children ? (
                    <NavGroup
                      key={item.key}
                      item={item}
                      pathname={pathname}
                      withQuery={withQuery}
                      onNavigate={closeOnMobile}
                    />
                  ) : (
                    <SidebarMenuItem key={item.key}>
                      {item.ready ? (
                        <SidebarMenuButton
                          className={RAIL_BUTTON}
                          tooltip={item.title}
                          isActive={pathname.startsWith(item.href)}
                          render={
                            <Link
                              href={withQuery(item.href)}
                              onClick={closeOnMobile}
                            />
                          }
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          className={RAIL_BUTTON}
                          tooltip={`${item.title} (coming soon)`}
                          disabled
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <SoonBadge />
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/** An expandable item (Parameters). In the collapsed rail it links straight
 * to its first page. */
function NavGroup({
  item,
  pathname,
  withQuery,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  withQuery: (href: string) => string
  onNavigate: () => void
}) {
  const children = item.children ?? []
  const anyReady = children.some((c) => c.ready)
  const activeChild = children.some((c) => pathname.startsWith(c.href))
  const [open, setOpen] = React.useState(activeChild)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={RAIL_BUTTON}
        tooltip={anyReady ? item.title : `${item.title} (coming soon)`}
        isActive={activeChild}
        aria-expanded={open}
        disabled={!anyReady}
        onClick={() => setOpen((o) => !o)}
      >
        <item.icon />
        <span>{item.title}</span>
        {anyReady ? (
          <ChevronRightIcon
            className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
          />
        ) : (
          <SoonBadge />
        )}
      </SidebarMenuButton>
      {anyReady && open && (
        <SidebarMenuSub>
          {children.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              {child.ready ? (
                <SidebarMenuSubButton
                  isActive={pathname.startsWith(child.href)}
                  render={
                    <Link href={withQuery(child.href)} onClick={onNavigate} />
                  }
                >
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              ) : (
                <SidebarMenuSubButton
                  aria-disabled
                  className="pointer-events-none opacity-60"
                >
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              )}
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}
