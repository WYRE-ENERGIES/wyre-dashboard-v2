"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { CardError, InfoHint } from "@/components/dashboard/card-parts"
import type { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { seriesColors } from "@/lib/dashboard/colors"
import { energySeries } from "@/lib/dashboard/metrics"
import { formatDeviceName, formatNumber } from "@/lib/format"
import { GRANULARITY, periodLabel } from "@/lib/period"

const TITLES = { hourly: "Hourly energy", daily: "Daily energy", monthly: "Monthly energy" } as const

/** Stacked energy-by-source bars at the period's granularity. */
export function EnergyChart({ data }: { data: ReturnType<typeof useDashboardData> }) {
  const { period, selectedDeviceIds } = useFilters()
  const granularity = GRANULARITY[period.kind]
  // Day uses device_usage's hourly series; Month and Year use daily_consumption.
  const query = period.kind === "day" ? data.deviceUsage : data.dailyConsumption

  const series = energySeries(period, data.deviceUsage.data, data.dailyConsumption.data, selectedDeviceIds)
  const colors = seriesColors(series.devices)
  const config: ChartConfig = Object.fromEntries(
    series.devices.map((device, index) => [
      device.key,
      { label: formatDeviceName(device.name), color: colors[index] },
    ])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLES[granularity]} by source</CardTitle>
        <CardDescription>{periodLabel(period)} · kWh</CardDescription>
        <CardAction>
          <InfoHint>
            Energy consumed per {granularity === "hourly" ? "hour" : granularity === "daily" ? "day" : "month"},
            split by the source that supplied it.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : series.devices.length === 0 ? (
          <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No energy sources in the current selection.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={series.rows} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={granularity === "hourly" ? 16 : 4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value: number) => formatNumber(value, 0)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
                          {config[String(name)]?.label ?? name}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatNumber(Number(value))} kWh
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.devices.map((device, index) => (
                <Bar
                  key={device.key}
                  dataKey={device.key}
                  stackId="energy"
                  fill={`var(--color-${device.key})`}
                  radius={index === series.devices.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
