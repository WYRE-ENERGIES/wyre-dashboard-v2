"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DeviceFilter } from "@/components/device-filter"
import { FiltersProvider } from "@/components/filters-provider"
import { PeriodPicker } from "@/components/period-picker"
import { useSession } from "@/components/session-provider"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { WyreLogo } from "@/components/wyre-logo"

/** Signed-in chrome: navigation sidebar, global filter bar, page content.
 * Redirects to /login when there is no session. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { claims } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (claims === null)
      router.replace(`/login?from=${encodeURIComponent(pathname)}`)
  }, [claims, pathname, router])

  if (!claims) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <FiltersProvider>
      {/* Collapsed rail is wide enough for the full-size logo. */}
      <SidebarProvider
        style={{ "--sidebar-width-icon": "5rem" } as React.CSSProperties}
      >
        <AppSidebar />
        {/* min-w-0 lets wide tables scroll inside their cards instead of widening the page. */}
        <SidebarInset className="min-w-0">
          {/* Desktop: one row (trigger · period · devices). Mobile: trigger,
              logo and devices on top, the period picker on its own row. */}
          <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-2 gap-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
            <SidebarTrigger className="order-1 -ml-1" />
            <WyreLogo className="order-2 h-6 text-primary md:hidden" />
            <Separator
              orientation="vertical"
              className="order-2 mr-1 hidden h-5 md:block"
            />
            <div className="order-4 w-full md:order-3 md:w-auto">
              <PeriodPicker />
            </div>
            <div className="order-3 ml-auto md:order-5">
              <DeviceFilter />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </FiltersProvider>
  )
}
