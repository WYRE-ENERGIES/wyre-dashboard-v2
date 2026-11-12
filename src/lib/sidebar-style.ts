"use client"

import * as React from "react"

/**
 * Sidebar looks to compare (user menu → Sidebar style). The choice is kept
 * per browser and set as `data-nav-style` on <html>; globals.css restyles the
 * sidebar from it, and `grouped` styles split the menu into sections.
 */
export const SIDEBAR_STYLES = [
  {
    value: "standard",
    label: "Standard",
    description: "Light sidebar, highlighted pill",
    grouped: false,
  },
  {
    value: "classic",
    label: "Wyre classic",
    description: "Brand purple, like the current dashboard",
    grouped: false,
  },
  {
    value: "ink",
    label: "Ink",
    description: "Dark, sections, yellow marker",
    grouped: true,
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Page colour, sections, thin marker",
    grouped: true,
  },
] as const

export type SidebarStyle = (typeof SIDEBAR_STYLES)[number]["value"]

const STORAGE_KEY = "wyre.sidebar-style"
const EVENT = "wyre:sidebar-style"
const DEFAULT: SidebarStyle = "standard"

function read(): SidebarStyle {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return SIDEBAR_STYLES.some((s) => s.value === value)
      ? (value as SidebarStyle)
      : DEFAULT
  } catch {
    return DEFAULT
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function setSidebarStyle(style: SidebarStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, style)
  } catch {
    // Private mode etc.: the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The current style, kept on <html> as `data-nav-style` for the CSS. */
export function useSidebarStyle() {
  const style = React.useSyncExternalStore(subscribe, read, () => DEFAULT)
  React.useEffect(() => {
    document.documentElement.dataset.navStyle = style
  }, [style])
  return SIDEBAR_STYLES.find((s) => s.value === style) ?? SIDEBAR_STYLES[0]
}
