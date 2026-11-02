"use client"

import { useQuery } from "@tanstack/react-query"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  getBlendedCost,
  getBranchDemand,
  getDailyConsumption,
  getDeviceUsage,
  getTotalEnergy,
} from "@/lib/api/endpoints"
import { serializePeriod } from "@/lib/period"

/** One query per endpoint, so each card loads (and fails) on its own. */
export function useDashboardData() {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const { view, date } = serializePeriod(period)
  const base = [branchId, view, date] as const

  const totalEnergy = useQuery({
    queryKey: ["dashboard", "total-energy", ...base],
    queryFn: ({ signal }) => getTotalEnergy(branchId, period, signal),
  })
  const deviceUsage = useQuery({
    queryKey: ["dashboard", "device-usage", ...base],
    queryFn: ({ signal }) => getDeviceUsage(branchId, period, signal),
  })
  // Daily points feed the Month and Year charts; the Day chart uses the
  // hourly series from device_usage instead.
  const dailyConsumption = useQuery({
    queryKey: ["dashboard", "daily-consumption", ...base],
    queryFn: ({ signal }) => getDailyConsumption(branchId, period, signal),
    enabled: period.kind !== "day",
  })
  const demand = useQuery({
    queryKey: ["dashboard", "branch-demand", ...base],
    queryFn: ({ signal }) => getBranchDemand(branchId, period, signal),
  })
  const blendedCost = useQuery({
    queryKey: ["dashboard", "blended-cost", ...base],
    queryFn: ({ signal }) => getBlendedCost(branchId, period, signal),
  })

  return {
    period,
    totalEnergy,
    deviceUsage,
    dailyConsumption,
    demand,
    blendedCost,
  }
}
