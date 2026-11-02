"use client"

import type { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { loadShares } from "@/lib/dashboard/metrics"
import { formatDeviceName, formatNumber } from "@/lib/format"

/** BESPOKE-only block: each load's share of total load energy. */
export function LoadOverviewCard({
  data,
}: {
  data: ReturnType<typeof useDashboardData>
}) {
  const { selectedDeviceIds } = useFilters()
  const loads = loadShares(data.totalEnergy.data, selectedDeviceIds).sort(
    (a, b) => b.percent - a.percent
  )
  if (!loads.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Load overview</CardTitle>
        <CardDescription>Share of load energy by device</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loads.map((load) => (
          <div key={load.name} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="truncate">{formatDeviceName(load.name)}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(load.kwh)} kWh · {formatNumber(load.percent, 1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${load.percent}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
