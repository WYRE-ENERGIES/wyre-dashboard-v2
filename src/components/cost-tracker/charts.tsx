"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import { SectionCard } from "@/components/cost-tracker/shared"
import { useFilters } from "@/components/filters-provider"
import { Stat } from "@/components/shared/card-parts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { getSideBar } from "@/lib/api/endpoints"
import type {
  BaselineResponse,
  DieselPurchase,
  Payment,
} from "@/lib/api/cost-tracker-types"
import { baselineBuckets, costBuckets } from "@/lib/cost-tracker/rules"
import { formatNaira, formatNumber } from "@/lib/format"

/** Compact axis labels: 1.2M, 350k. */
const compact = (value: number) =>
  Math.abs(value) >= 1_000_000
    ? `${formatNumber(value / 1_000_000, 1)}M`
    : Math.abs(value) >= 1_000
      ? `${formatNumber(value / 1_000, 0)}k`
      : formatNumber(value, 0)

function tooltipRow(label: string, color: string | undefined, value: string) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="size-2.5 rounded-[2px]"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="font-mono text-foreground tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Cost of energy per month (Year) or per day (Month/Day), stacked by source,
 * from the registers. Fixes the old chart, which summed price per litre and
 * stayed empty when there were no utility rows.
 */
export function CostChart({
  diesel,
  utility,
  ipp,
  showIpp,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  diesel: DieselPurchase[]
  utility: Payment[]
  ipp: Payment[]
  showIpp: boolean
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const { period } = useFilters()
  const monthly = period.kind === "year"
  const data = costBuckets(period, diesel, utility, showIpp ? ipp : [])
  const config: ChartConfig = {
    diesel: { label: "Diesel", color: "var(--chart-1)" },
    utility: { label: "Utility", color: "var(--chart-2)" },
    ...(showIpp ? { ipp: { label: "IPP", color: "var(--chart-5)" } } : {}),
  }
  const keys = Object.keys(config) as Array<"diesel" | "utility" | "ipp">
  const total = data.reduce((t, b) => t + b.diesel + b.utility + b.ipp, 0)

  return (
    <SectionCard
      title={monthly ? "Monthly cost" : "Daily cost"}
      description={`${periodText} · ₦, by purchase date`}
      hint="Total cost of energy bought: diesel (price per litre × quantity) plus utility and IPP payments."
      error={isError}
      onRetry={onRetry}
    >
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : total === 0 ? (
        <p className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
          No bills recorded for this period.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Stat value={formatNaira(total)} className="text-xl" />
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={compact}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.tooltipLabel ?? ""
                    }
                    formatter={(value, name, item) =>
                      tooltipRow(
                        String(config[String(name)]?.label ?? name),
                        item.color,
                        formatNaira(Number(value))
                      )
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {keys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="cost"
                  fill={`var(--color-${key})`}
                  radius={index === keys.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}

/**
 * Wyre's baseline forecast vs actual consumption per month (old
 * EnergyConsumptionMultipleChart). Follows the global device filter.
 */
export function BaselineChart({
  data: response,
  branchName,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  data: BaselineResponse | undefined
  branchName: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const { period, selectedDeviceIds } = useFilters()
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const devices = sideBar.data?.authenticatedData.branches[0]?.devices ?? []
  const deviceNames = devices
    .filter((d) => selectedDeviceIds.includes(d.device_id))
    .map((d) => d.name)
  const data = baselineBuckets(response?.data?.baseline, period, deviceNames)
  const config: ChartConfig = {
    used: { label: "Consumption", color: "var(--chart-2)" },
    forecast: { label: "Forecast", color: "var(--chart-5)" },
  }
  const empty = data.every((b) => b.used === 0 && b.forecast === 0)
  const single = data.length === 1 ? data[0] : null

  return (
    <SectionCard
      title={`Energy consumption${branchName ? ` at ${branchName}` : ""}`}
      description={`${periodText} · kWh${selectedDeviceIds.length ? " · selected devices" : ""}`}
      hint="A comparison of Wyre's baseline energy forecast against actual energy consumption."
      error={isError}
      onRetry={onRetry}
    >
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : empty ? (
        <p className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">
          No baseline data for this period.
        </p>
      ) : single ? (
        // A single month reads better as numbers than as one bar.
        <div className="grid gap-4 sm:grid-cols-3">
          <BaselineStat
            label="Consumption"
            value={`${formatNumber(single.used)}`}
            unit="kWh"
          />
          <BaselineStat
            label="Forecast"
            value={`${formatNumber(single.forecast)}`}
            unit="kWh"
          />
          <BaselineStat
            label="Against forecast"
            value={
              single.forecast
                ? `${single.used >= single.forecast ? "+" : ""}${formatNumber(((single.used - single.forecast) / single.forecast) * 100, 1)}%`
                : "0%"
            }
          />
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <ComposedChart data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={compact}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.tooltipLabel ?? ""
                  }
                  formatter={(value, name, item) =>
                    tooltipRow(
                      String(config[String(name)]?.label ?? name),
                      item.color ?? item.stroke,
                      `${formatNumber(Number(value))} kWh`
                    )
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="used"
              fill="var(--color-used)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="forecast"
              type="monotone"
              stroke="var(--color-forecast)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-forecast)" }}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </SectionCard>
  )
}

function BaselineStat({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Stat value={value} unit={unit} className="text-xl" />
    </div>
  )
}
