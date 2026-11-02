"use client"

import { useQuery } from "@tanstack/react-query"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  getCostMetrics,
  getDieselPrice,
  getFuelUsageSeries,
  getGeneratorEnergyFuelSeries,
  getGeneratorMetrics,
  getGeneratorRuntimeFuel,
  getGeneratorsCo2,
  getGeneratorsMonthlyEnergy,
  getGeneratorsStatus,
} from "@/lib/api/diesel"
import type { MonthYear } from "@/lib/api/diesel-types"
import { getSideBar } from "@/lib/api/endpoints"
import {
  mergeCostMetrics,
  mergeGeneratorMetrics,
  mergeMonthlyEnergy,
  mergeRuntimeFuel,
  monthsOfPeriod,
  shapeFuelUsage,
  shapeGeneratorSeries,
  sumNumbers,
} from "@/lib/diesel/metrics"
import { serializePeriod } from "@/lib/period"

/** Fetch one month-based endpoint for every month the period needs. */
const perMonth = <T>(
  months: MonthYear[],
  fetch: (my: MonthYear) => Promise<T>
) => Promise.all(months.map(fetch))

/**
 * One query per endpoint, so each card loads and fails on its own. A Year
 * period fans out to one request per month inside the same query.
 */
export function useDieselData() {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const { view, date } = serializePeriod(period)
  const months = monthsOfPeriod(period)
  const key = [branchId, view, date] as const

  // Not period-based: current generator state and the current diesel price.
  const status = useQuery({
    queryKey: ["diesel", "generators-status", branchId],
    queryFn: ({ signal }) => getGeneratorsStatus(branchId, signal),
  })
  const price = useQuery({
    queryKey: ["diesel", "diesel-price", branchId],
    queryFn: ({ signal }) => getDieselPrice(branchId, signal),
  })

  const co2 = useQuery({
    queryKey: ["diesel", "generators-co2", ...key],
    queryFn: async ({ signal }) =>
      sumNumbers(
        await perMonth(months, (my) => getGeneratorsCo2(branchId, my, signal))
      ),
  })
  const energy = useQuery({
    queryKey: ["diesel", "generators-monthly-energy", ...key],
    queryFn: async ({ signal }) =>
      mergeMonthlyEnergy(
        await perMonth(months, (my) =>
          getGeneratorsMonthlyEnergy(branchId, my, signal)
        )
      ),
    // A Day shows that day's kWh from the daily series instead.
    enabled: period.kind !== "day",
  })
  const runtimeFuel = useQuery({
    queryKey: ["diesel", "generator-runtime-fuel-usage", ...key],
    queryFn: async ({ signal }) =>
      mergeRuntimeFuel(
        await perMonth(months, (my) =>
          getGeneratorRuntimeFuel(branchId, my, signal)
        )
      ),
  })
  const series = useQuery({
    queryKey: ["diesel", "generator-energy-fuel-series", ...key],
    queryFn: async ({ signal }) =>
      shapeGeneratorSeries(
        period,
        await perMonth(months, (my) =>
          getGeneratorEnergyFuelSeries(branchId, my, signal)
        ),
        months
      ),
  })
  const fuelUsage = useQuery({
    queryKey: ["diesel", "fuel-usage-series", ...key],
    queryFn: async ({ signal }) =>
      shapeFuelUsage(
        period,
        await perMonth(months, (my) =>
          getFuelUsageSeries(branchId, my, signal)
        ),
        months
      ),
  })
  const metrics = useQuery({
    queryKey: ["diesel", "generator-metrics", ...key],
    queryFn: async ({ signal }) =>
      mergeGeneratorMetrics(
        await perMonth(months, (my) =>
          getGeneratorMetrics(branchId, my, signal)
        )
      ),
  })
  const cost = useQuery({
    queryKey: ["diesel", "cost-metrics", ...key],
    queryFn: async ({ signal }) =>
      mergeCostMetrics(
        await perMonth(months, (my) => getCostMetrics(branchId, my, signal))
      ),
  })

  // Same query the device filter uses: maps selected device ids to names.
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const devices = sideBar.data?.authenticatedData.branches[0]?.devices

  return {
    period,
    months,
    status,
    price,
    co2,
    energy,
    runtimeFuel,
    series,
    fuelUsage,
    metrics,
    cost,
    devices,
  }
}

export type DieselData = ReturnType<typeof useDieselData>
