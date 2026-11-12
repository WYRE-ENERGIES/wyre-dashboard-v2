"use client"

import * as React from "react"

import { useSidebar } from "@/components/ui/sidebar"

/**
 * On phones the sidebar is a sheet over the page: close it once an item has
 * taken the user somewhere. Items that open or change something in place
 * (Parameters' submenu, the branch and user menus, theme, sidebar style)
 * leave it open. A no-op on desktop.
 */
export function useCloseOnMobile() {
  const { isMobile, setOpenMobile } = useSidebar()
  return React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])
}
