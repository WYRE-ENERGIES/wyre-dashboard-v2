"use client"

import { useQuery } from "@tanstack/react-query"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import { getSideBar } from "@/lib/api/endpoints"
import { periodShortLabel, serializePeriod } from "@/lib/period"

/** Branch, period and query-key base shared by the Parameters pages. */
export function useParameterFilters() {
  const claims = useClaims()
  const { period, selectedDeviceIds } = useFilters()
  const { view, date } = serializePeriod(period)
  // Same cache entry as the device filter and dashboard.
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const branch = sideBar.data?.authenticatedData.branches[0]
  const selectedNames = selectedDeviceIds.length
    ? (branch?.devices ?? [])
        .filter((d) => selectedDeviceIds.includes(d.device_id))
        .map((d) => d.name)
    : null

  return {
    claims,
    branchId: claims.branch_id,
    period,
    selectedDeviceIds,
    /** Names of the ticked devices (endpoints keyed by name), null = all. */
    selectedNames,
    branchName: branch?.name,
    keyBase: [claims.branch_id, view, date] as const,
    /** Filename part, e.g. "lekki-branch-oct-2026". */
    fileTag: [branch?.name ?? "", periodShortLabel(period)].filter(Boolean),
  }
}
