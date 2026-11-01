"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { useClaims } from "@/components/session-provider"
import { defaultPeriod, parsePeriod, serializePeriod, type Period } from "@/lib/period"

type FiltersContextValue = {
  period: Period
  setPeriod: (period: Period) => void
  /** Device ids ticked in the device filter; empty means all devices. */
  selectedDeviceIds: number[]
  setSelectedDeviceIds: (ids: number[]) => void
}

const FiltersContext = React.createContext<FiltersContextValue | null>(null)

/**
 * Global filters every page reads (inventory decision #1). The period lives
 * in the URL (?view=month&date=2026-07) so views can be bookmarked and shared;
 * the device selection is per branch and resets when the branch changes.
 */
export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { branch_id: branchId } = useClaims()

  const view = searchParams.get("view")
  const date = searchParams.get("date")
  const period = React.useMemo(() => parsePeriod(view, date) ?? defaultPeriod(), [view, date])

  const setPeriod = React.useCallback(
    (next: Period) => {
      const params = new URLSearchParams(searchParams.toString())
      const { view, date } = serializePeriod(next)
      params.set("view", view)
      params.set("date", date)
      // The native history API updates useSearchParams without a server
      // round trip, so changing the period feels instant.
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`)
    },
    [pathname, searchParams]
  )

  const [selection, setSelection] = React.useState<{ branchId: number; ids: number[] }>({
    branchId,
    ids: [],
  })
  const selectedDeviceIds = React.useMemo(
    () => (selection.branchId === branchId ? selection.ids : []),
    [selection, branchId]
  )
  const setSelectedDeviceIds = React.useCallback(
    (ids: number[]) => setSelection({ branchId, ids }),
    [branchId]
  )

  const value = React.useMemo(
    () => ({ period, setPeriod, selectedDeviceIds, setSelectedDeviceIds }),
    [period, setPeriod, selectedDeviceIds, setSelectedDeviceIds]
  )
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters() {
  const context = React.useContext(FiltersContext)
  if (!context) throw new Error("useFilters must be used within <FiltersProvider>")
  return context
}
