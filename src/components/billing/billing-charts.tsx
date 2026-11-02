"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { CardError } from "@/components/shared/card-parts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { BillingChartRow } from "@/lib/billing/metrics"
import { seriesColors } from "@/lib/dashboard/colors"
import { formatDeviceName, formatNaira, formatNumber } from "@/lib/format"
import { GRANULARITY, periodLabel, type Period } from "@/lib/period"

const PER = { hourly: "Hourly", daily: "Daily", monthly: "Monthly" } as const

type State = { loading: boolean; error: boolean; onRetry: () => void }

function TooltipRow({
  color,
  name,
  value,
}: {
  color?: string
  name: React.ReactNode
  value: string
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color && (
          <span
            className="size-2.5 rounded-[2px]"
            style={{ background: color }}
          />
        )}
        {name}
      </span>
      <span className="font-mono text-foreground tabular-nums">{value}</span>
    </div>
  )
}

/** Stacked kWh per device (old BillingConsumptionKwhBarChart). */
export function BillingKwhChart({
  period,
  rows,
  series,
  state,
}: {
  period: Period
  rows: BillingChartRow[]
  series: Array<{ key: string; name: string; deviceType?: string }>
  state: State
}) {
  const colors = seriesColors(series)
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: formatDeviceName(s.name), color: colors[i] },
    ])
  )
  const granularity = GRANULARITY[period.kind]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{PER[granularity]} consumption by device</CardTitle>
        <CardDescription>{periodLabel(period)} · kWh</CardDescription>
      </CardHeader>
      <CardContent>
        {state.loading ? (
          <Skeleton className="h-72 w-full" />
        ) : state.error ? (
          <CardError onRetry={state.onRetry} />
        ) : !series.length ? (
          <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No billed devices in the current selection.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={rows} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v: number) => formatNumber(v, 0)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.tooltipLabel ?? ""
                    }
                    formatter={(value, name, item) => (
                      <TooltipRow
                        color={item.color}
                        name={config[String(name)]?.label ?? name}
                        value={`${formatNumber(Number(value))} kWh`}
                      />
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="kwh"
                  fill={`var(--color-${s.key})`}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/** Total ₦ per bucket (old BillingConsumptionNairaBarChart). */
export function BillingNairaChart({
  period,
  rows,
  state,
}: {
  period: Period
  rows: BillingChartRow[]
  state: State
}) {
  const config: ChartConfig = {
    naira: { label: "Cost", color: "var(--chart-2)" },
  }
  const granularity = GRANULARITY[period.kind]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{PER[granularity]} cost</CardTitle>
        <CardDescription>{periodLabel(period)} · ₦</CardDescription>
      </CardHeader>
      <CardContent>
        {state.loading ? (
          <Skeleton className="h-72 w-full" />
        ) : state.error ? (
          <CardError onRetry={state.onRetry} />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={rows} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `₦${formatNumber(v / 1_000_000, 1)}m`
                    : v >= 1000
                      ? `₦${formatNumber(v / 1000, 0)}k`
                      : `₦${formatNumber(v, 0)}`
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.tooltipLabel ?? ""
                    }
                    formatter={(value, _name, item) => (
                      <TooltipRow
                        color={item.color}
                        name="Cost"
                        value={formatNaira(Number(value))}
                      />
                    )}
                  />
                }
              />
              <Bar
                dataKey="naira"
                fill="var(--color-naira)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
