"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import type { SolarData } from "@/components/solar/use-solar-data"
import { CardError, InfoHint } from "@/components/shared/card-parts"
import {
  Card,
  CardAction,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatNumber } from "@/lib/format"
import { GRANULARITY, periodLabel } from "@/lib/period"
import { bucketLabel } from "@/lib/solar/metrics"

/**
 * The three solar charts (old Consumption, PV Production and Battery cards).
 * The global period replaces their per-chart day pickers:
 * - Day → hourly kW from the hourly-plot endpoints;
 * - Month → kWh per day, Year → kWh per month, from `solar/yield` per bucket.
 */

type Series = { key: string; label: string; color: string }

function grainOf(data: SolarData) {
  const isDay = data.period.kind === "day"
  const daily = GRANULARITY[data.period.kind] === "daily"
  return {
    isDay,
    unit: isDay ? "kW" : "kWh",
    grain: isDay ? "Hourly" : daily ? "Daily" : "Monthly",
    description: `${isDay ? "Hourly, kW" : daily ? "Daily, kWh" : "Monthly, kWh"} · ${periodLabel(data.period)}`,
  }
}

const bucketRows = <T extends { key: string }>(rows: T[]) =>
  rows.map((r) => ({
    ...r,
    label: bucketLabel(r.key),
    tooltipLabel: bucketLabel(r.key, true),
  }))

function Badges({
  items,
  ready,
}: {
  items: Array<{ label: string; value: string; sub?: string | null } | null>
  /** Only once the data has loaded, so totals never flash as 0. */
  ready: boolean
}) {
  const shown = items.filter((i): i is NonNullable<typeof i> => i !== null)
  if (!ready || !shown.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((i) => (
        <div
          key={i.label}
          className="rounded-lg border bg-muted/40 px-3 py-1.5"
        >
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className="text-sm font-semibold tabular-nums">
            {i.value}
            {i.sub && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {i.sub}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartBody({
  query,
  empty,
  children,
}: {
  query: Pick<UseQueryResult, "isPending" | "isError" | "refetch">
  empty: boolean
  children: React.ReactNode
}) {
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError) return <CardError onRetry={() => query.refetch()} />
  if (empty)
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data for this period.
      </p>
    )
  return <>{children}</>
}

/** Area chart for hourly kW, bars for daily/monthly kWh. */
/** A percentage series drawn as a line on its own 0–100 % right axis. */
type PercentLine = Series

function SeriesChart({
  rows,
  series,
  unit,
  asArea,
  extraTooltip,
  percentLine,
}: {
  rows: Array<Record<string, unknown>>
  series: Series[]
  unit: string
  asArea: boolean
  extraTooltip?: (row: Record<string, unknown>) => React.ReactNode
  percentLine?: PercentLine
}) {
  const config: ChartConfig = Object.fromEntries(
    [...series, ...(percentLine ? [percentLine] : [])].map((s) => [
      s.key,
      { label: s.label, color: s.color },
    ])
  )
  const tooltip = (
    <ChartTooltip
      cursor={asArea}
      content={
        <ChartTooltipContent
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as
              Record<string, unknown> | undefined
            return (
              <div className="flex flex-col gap-0.5">
                <span>{String(row?.tooltipLabel ?? row?.label ?? "")}</span>
                {row && extraTooltip?.(row)}
              </div>
            )
          }}
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
                {name === percentLine?.key
                  ? `${formatNumber(Number(value), 1)}%`
                  : `${formatNumber(Number(value), unit === "kW" ? 2 : 1)} ${unit}`}
              </span>
            </div>
          )}
        />
      }
    />
  )
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={12}
      />
      <YAxis
        yAxisId="value"
        tickLine={false}
        axisLine={false}
        width={44}
        tickFormatter={(v: number) => formatNumber(v, 0)}
      />
    </>
  )
  if (percentLine) {
    return (
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <ComposedChart
          data={rows}
          margin={{ left: 4, right: 4, top: 8 }}
          barCategoryGap="20%"
        >
          {axes}
          <YAxis
            yAxisId="percent"
            orientation="right"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}%`}
          />
          {tooltip}
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s) =>
            asArea ? (
              <Area
                key={s.key}
                yAxisId="value"
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                fill={`var(--color-${s.key})`}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            ) : (
              <Bar
                key={s.key}
                yAxisId="value"
                dataKey={s.key}
                fill={`var(--color-${s.key})`}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            )
          )}
          <Line
            yAxisId="percent"
            dataKey={percentLine.key}
            type="monotone"
            stroke={`var(--color-${percentLine.key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </ComposedChart>
      </ChartContainer>
    )
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      {asArea ? (
        <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          {axes}
          {tooltip}
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s) => (
            <Area
              key={s.key}
              yAxisId="value"
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              fill={`var(--color-${s.key})`}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart
          data={rows}
          margin={{ left: 4, right: 4, top: 8 }}
          barCategoryGap="20%"
        >
          {axes}
          {tooltip}
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s) => (
            <Bar
              key={s.key}
              yAxisId="value"
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  )
}

const PARAMETERS = {
  production: { label: "Production", color: "var(--chart-5)" },
  grid: { label: "Grid", color: "var(--chart-1)" },
  load: { label: "Load", color: "var(--chart-2)" },
} as const
type Parameter = keyof typeof PARAMETERS

/** Old "Consumption" card: production, grid and load, with a parameter filter. */
export function ParametersChart({ data }: { data: SolarData }) {
  const g = grainOf(data)
  const [shown, setShown] = useState<"all" | Parameter>("all")
  const query = g.isDay ? data.consumption : data.series
  const rows = g.isDay
    ? (data.consumption.data?.points ?? []).map((p) => ({
        label: p.label,
        production: p.pvKw,
        grid: p.gridKw,
        load: p.loadKw,
      }))
    : bucketRows(data.rows).map((r) => ({
        ...r,
        production: r.productionKwh,
        grid: r.gridKwh,
        load: r.loadKwh,
      }))
  const totals = g.isDay
    ? {
        production: data.consumption.data?.totalProductionKwh ?? null,
        consumption: data.consumption.data?.totalConsumptionKwh ?? null,
      }
    : {
        production: data.rows.reduce((a, r) => a + r.productionKwh, 0),
        consumption: data.rows.reduce((a, r) => a + r.loadKwh, 0),
      }
  const series = (Object.keys(PARAMETERS) as Parameter[])
    .filter((k) => shown === "all" || shown === k)
    .map((k) => ({ key: k, ...PARAMETERS[k] }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>All parameters</CardTitle>
        <CardDescription>{g.description}</CardDescription>
        <CardAction>
          <InfoHint>
            Solar production, grid import and the building&apos;s load.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badges
            ready={query.isSuccess}
            items={[
              totals.production != null
                ? {
                    label: "Total production",
                    value: `${formatNumber(totals.production, 1)} kWh`,
                  }
                : null,
              totals.consumption != null
                ? {
                    label: "Total consumption",
                    value: `${formatNumber(totals.consumption, 1)} kWh`,
                  }
                : null,
            ]}
          />
          <ToggleGroup
            value={[shown]}
            onValueChange={(v: string[]) =>
              v[0] && setShown(v[0] as "all" | Parameter)
            }
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Parameters shown"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="production">Production</ToggleGroupItem>
            <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
            <ToggleGroupItem value="load">Load</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ChartBody query={query} empty={rows.length === 0}>
          <SeriesChart
            rows={rows}
            series={series}
            unit={g.unit}
            asArea={g.isDay}
          />
        </ChartBody>
      </CardContent>
    </Card>
  )
}

/** Old "PV Production" card. */
export function PvProductionChart({ data }: { data: SolarData }) {
  const g = grainOf(data)
  const query = g.isDay ? data.pv : data.series
  const rows = g.isDay
    ? (data.pv.data?.points ?? []).map((p) => ({
        label: p.label,
        production: p.pvKw,
      }))
    : bucketRows(data.rows).map((r) => ({ ...r, production: r.productionKwh }))
  const peakBucket = g.isDay
    ? null
    : data.rows.reduce<(typeof data.rows)[number] | null>(
        (a, r) => (!a || r.productionKwh > a.productionKwh ? r : a),
        null
      )
  const badges = g.isDay
    ? [
        data.pv.data?.totalKwh != null
          ? {
              label: "Total production",
              value: `${formatNumber(data.pv.data.totalKwh, 1)} kWh`,
            }
          : null,
        data.pv.data?.peakKw != null
          ? {
              label: "Peak production",
              value: `${formatNumber(data.pv.data.peakKw, 1)} kW`,
              sub: data.pv.data.peakAt ? `at ${data.pv.data.peakAt}` : null,
            }
          : null,
      ]
    : [
        {
          label: "Total production",
          value: `${formatNumber(
            data.rows.reduce((a, r) => a + r.productionKwh, 0),
            1
          )} kWh`,
        },
        peakBucket && peakBucket.productionKwh > 0
          ? {
              label: data.period.kind === "year" ? "Best month" : "Best day",
              value: `${formatNumber(peakBucket.productionKwh, 1)} kWh`,
              sub: bucketLabel(peakBucket.key),
            }
          : null,
      ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>PV production</CardTitle>
        <CardDescription>{g.description}</CardDescription>
        <CardAction>
          <InfoHint>Energy the solar panels produced.</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badges ready={query.isSuccess} items={badges} />
        <ChartBody query={query} empty={rows.length === 0}>
          <SeriesChart
            rows={rows}
            series={[{ key: "production", ...PARAMETERS.production }]}
            unit={g.unit}
            asArea={g.isDay}
          />
        </ChartBody>
      </CardContent>
    </Card>
  )
}

/** Old "Battery" card (07 §2.6): charge and discharge, SOC in the tooltip. */
export function BatteryChart({ data }: { data: SolarData }) {
  const g = grainOf(data)
  const query = g.isDay ? data.battery : data.series
  const rows: Array<Record<string, unknown>> = g.isDay
    ? (data.battery.data?.points ?? []).map((p) => ({
        label: p.label,
        charge: p.chargeKw,
        discharge: p.dischargeKw,
        soc: p.socPct,
      }))
    : bucketRows(data.rows).map((r) => ({
        ...r,
        charge: r.chargeKwh,
        discharge: r.dischargeKwh,
        soc: data.dailySoc.data?.get(r.key) ?? null,
      }))
  // Hourly SOC for a day, the daily average for a month or range; a year
  // has no SOC data.
  const hasSoc = rows.some((r) => typeof r.soc === "number")
  const totalCharge = g.isDay
    ? (data.battery.data?.totalCharge ?? null)
    : data.rows.reduce((a, r) => a + r.chargeKwh, 0)
  const totalDischarge = g.isDay
    ? (data.battery.data?.totalDischarge ?? null)
    : data.rows.reduce((a, r) => a + r.dischargeKwh, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Battery</CardTitle>
        <CardDescription>{g.description}</CardDescription>
        <CardAction>
          <InfoHint>
            Energy going into the battery (charge) and out of it (discharge).
            The line is the battery&apos;s state of charge (right axis):
            {g.isDay
              ? " hourly."
              : data.period.kind === "year"
                ? " not available for a whole year; pick a month or days."
                : " each day's average."}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badges
          ready={query.isSuccess}
          items={[
            // Production labels these day totals "kW"; they are energy, so kWh.
            totalCharge != null
              ? {
                  label: "Total charge",
                  value: `${formatNumber(totalCharge, 1)} kWh`,
                }
              : null,
            totalDischarge != null
              ? {
                  label: "Total discharge",
                  value: `${formatNumber(totalDischarge, 1)} kWh`,
                }
              : null,
          ]}
        />
        <ChartBody query={query} empty={rows.length === 0}>
          <SeriesChart
            rows={rows}
            series={[
              { key: "charge", label: "Charge", color: "var(--chart-1)" },
              { key: "discharge", label: "Discharge", color: "var(--chart-5)" },
            ]}
            unit={g.unit}
            asArea={g.isDay}
            percentLine={
              hasSoc
                ? {
                    key: "soc",
                    label: g.isDay ? "State of charge" : "Avg. state of charge",
                    color: "var(--destructive)",
                  }
                : undefined
            }
          />
        </ChartBody>
      </CardContent>
    </Card>
  )
}
