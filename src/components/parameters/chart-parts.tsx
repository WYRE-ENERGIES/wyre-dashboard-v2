"use client"

import type { ChartConfig } from "@/components/ui/chart"
import { ChartTooltipContent } from "@/components/ui/chart"
import { seriesColors } from "@/lib/dashboard/colors"
import { formatDeviceName, formatNumber } from "@/lib/format"
import type { SeriesDevice } from "@/lib/parameters/energy-consumption"

/** Chart config for per-device series: purple shades, yellow for solar. */
export function deviceChartConfig(devices: SeriesDevice[]): ChartConfig {
  const colors = seriesColors(
    devices.map((d) => ({ device_type: d.deviceType }))
  )
  return Object.fromEntries(
    devices.map((device, index) => [
      device.key,
      { label: formatDeviceName(device.name), color: colors[index] },
    ])
  )
}

/** Tooltip listing each series with its value and unit, titled by the
 * bucket's long label (rows carry `tooltipLabel`). */
export function UnitTooltip({
  config,
  unit,
  digits = 2,
}: {
  config: ChartConfig
  unit: string
  digits?: number
}) {
  return (
    <ChartTooltipContent
      labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
      formatter={(value, name, item) => (
        <div className="flex w-full items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 rounded-[2px]"
              style={{ background: item.color }}
            />
            {config[String(name)]?.label ?? name}
          </span>
          <span className="font-mono text-foreground tabular-nums">
            {value === null || value === undefined
              ? "No data"
              : `${formatNumber(Number(value), digits)}${unit ? ` ${unit}` : ""}`}
          </span>
        </div>
      )}
    />
  )
}

export const GRANULARITY_WORD = {
  hourly: "hour",
  daily: "day",
  monthly: "month",
} as const
