"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

export const PARAMETER_PAGES = [
  { href: "/parameters/energy-consumption", title: "Energy consumption" },
  { href: "/parameters/power-quality", title: "Power quality" },
  { href: "/parameters/power-demand", title: "Power demand" },
  { href: "/parameters/last-reading", title: "Last reading" },
  { href: "/parameters/time-of-use", title: "Time of use" },
] as const

/**
 * Sub-navigation shared by the five Parameters pages (the old header's
 * "Parameters" dropdown). Links keep the query string, so the global period
 * carries over between pages. Scrolls sideways on narrow screens.
 */
export function ParametersNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const activeRef = React.useRef<HTMLAnchorElement>(null)

  // On phones the row scrolls; bring the current page's tab into view.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [pathname])

  return (
    <nav
      aria-label="Parameters"
      className="-mx-1 [scrollbar-width:none] overflow-x-auto px-1"
    >
      <ul className="flex w-max min-w-full gap-1 border-b">
        {PARAMETER_PAGES.map((page) => {
          const active = pathname === page.href
          return (
            <li key={page.href}>
              <Link
                href={query ? `${page.href}?${query}` : page.href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active &&
                    "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand"
                )}
              >
                {page.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
