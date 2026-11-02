"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  EmptyNote,
  generatorPalette,
  scopeText,
} from "@/components/diesel/parts"
import type { DieselData } from "@/components/diesel/use-diesel-data"
import { useFilters } from "@/components/filters-provider"
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
import {
  pivotSeries,
  selectGenerators,
  seriesDateLabel,
  sumNumbers,
} from "@/lib/diesel/metrics"
import { formatNumber } from "@/lib/format"
import { GRANULARITY } from "@/lib/period"

const GRAIN = { hourly: "Daily", daily: "Daily", monthly: "Monthly" } as const

/**
 * Old FuelUsageBreakupCard.js: energy (and fuel, in the tooltip) per
 * generator over time. Its Daily/Monthly toggle is gone — the global period
 * sets the granularity (old defect: the toggle ignored the selected month).
 */
export function FuelBreakupCard({ data }: { data: DieselData }) {
  const { selectedDeviceIds } = useFilters()
  const { period } = data
  const query = data.series
  const gens = generatorPalette(
    selectGenerators(query.data ?? [], selectedDeviceIds, data.devices)
  )
  const rows = pivotSeries(gens).map((row) => ({
    ...row,
    label: seriesDateLabel(period, String(row.date)),
    tooltipLabel: seriesDateLabel(period, String(row.date), true),
  }))
  const config: ChartConfig = Object.fromEntries(
    gens.map((g) => [`${g.key}_kwh`, { label: g.label, color: g.color }])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generator fuel usage breakup</CardTitle>
        <CardDescription>
          {period.kind === "day"
            ? scopeText(period)
            : `${GRAIN[GRANULARITY[period.kind]]} · ${scopeText(period)}`}
        </CardDescription>
        <CardAction>
          <InfoHint>
            Energy each generator supplied and the diesel it burned to do it.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : gens.length === 0 ? (
          <EmptyNote className="h-72">
            No generators in the current selection.
          </EmptyNote>
        ) : period.kind === "day" ? (
          // One day is a single point per generator: a table reads better.
          <ul className="flex flex-col divide-y text-sm">
            {gens.map((g) => {
              const kwh = sumNumbers(g.points.map((p) => p.kwh))
              const fuel = sumNumbers(g.points.map((p) => p.fuelLitres))
              return (
                <li
                  key={g.key}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: g.color }}
                    />
                    <span className="truncate font-medium">{g.label}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatNumber(kwh, 1)} kWh
                  </span>
                  <span className="tabular-nums">
                    {formatNumber(fuel, 1)} L
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(fuel ? kwh / fuel : 0)} kWh/L
                  </span>
                </li>
              )
            })}
          </ul>
        ) : rows.length === 0 ? (
          <EmptyNote className="h-72">
            No generator data for this period.
          </EmptyNote>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
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
                width={52}
                tickFormatter={(v: number) => formatNumber(v, 0)}
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  className: "fill-muted-foreground text-xs",
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.tooltipLabel ?? ""
                    }
                    formatter={(value, name, item) => {
                      const key = String(name).replace(/_kwh$/, "")
                      const fuel = Number(item.payload?.[`${key}_fuel`] ?? 0)
                      return (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="size-2.5 rounded-[2px]"
                              style={{ background: item.color }}
                            />
                            {config[String(name)]?.label ?? name}
                          </span>
                          <span className="font-mono text-foreground tabular-nums">
                            {formatNumber(Number(value), 1)} kWh ·{" "}
                            {formatNumber(fuel, 1)} L
                          </span>
                        </div>
                      )
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {gens.map((g) => (
                <Line
                  key={g.key}
                  dataKey={`${g.key}_kwh`}
                  type="monotone"
                  stroke={`var(--color-${g.key}_kwh)`}
                  strokeWidth={2}
                  dot={rows.length <= 1}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const usageConfig = {
  reportedLitres: { label: "Reported usage", color: "var(--chart-2)" },
  emsLitres: { label: "EMS usage", color: "var(--chart-5)" },
} satisfies ChartConfig

/**
 * Old FuelUsageCard.js: litres the branch logged ("reported") vs litres the
 * meters imply ("EMS"). Branch-wide: the endpoint doesn't split by generator.
 */
export function FuelUsageCard({ data }: { data: DieselData }) {
  const { period } = data
  const query = data.fuelUsage
  const rows = (query.data ?? []).map((p) => ({
    ...p,
    label: seriesDateLabel(period, p.date),
    tooltipLabel: seriesDateLabel(period, p.date, true),
  }))
  const reported = sumNumbers(rows.map((r) => r.reportedLitres))
  const ems = sumNumbers(rows.map((r) => r.emsLitres))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuel usage: reported vs EMS</CardTitle>
        <CardDescription>
          {period.kind === "day"
            ? scopeText(period)
            : `${GRAIN[GRANULARITY[period.kind]]} · ${scopeText(period)}`}
        </CardDescription>
        <CardAction>
          <InfoHint>
            Reported usage is the diesel logged for the branch. EMS usage is
            what the generators&apos; metered output implies. A large gap is
            worth checking. Branch-wide: the device filter doesn&apos;t apply.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {query.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyNote className="h-72">No fuel data for this period.</EmptyNote>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Reported </span>
                <span className="font-medium tabular-nums">
                  {formatNumber(reported, 1)} L
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">EMS </span>
                <span className="font-medium tabular-nums">
                  {formatNumber(ems, 1)} L
                </span>
              </span>
            </div>
            <ChartContainer
              config={usageConfig}
              className="aspect-auto h-64 w-full"
            >
              <BarChart
                data={rows}
                margin={{ left: 4, right: 4 }}
                barCategoryGap="25%"
              >
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
                  width={52}
                  tickFormatter={(v: number) => formatNumber(v, 0)}
                  label={{
                    value: "L",
                    angle: -90,
                    position: "insideLeft",
                    className: "fill-muted-foreground text-xs",
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.tooltipLabel ?? ""
                      }
                      formatter={(value, name, item) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="size-2.5 rounded-[2px]"
                              style={{ background: item.color }}
                            />
                            {usageConfig[name as keyof typeof usageConfig]
                              ?.label ?? name}
                          </span>
                          <span className="font-mono text-foreground tabular-nums">
                            {formatNumber(Number(value), 1)} L
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="reportedLitres"
                  fill="var(--color-reportedLitres)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="emsLitres"
                  fill="var(--color-emsLitres)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
