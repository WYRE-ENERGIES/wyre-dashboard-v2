"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatHours, formatNumber } from "@/lib/format"
import type { MonthlyReportModel, Source } from "@/lib/report/monthly"

function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string
  label: React.ReactNode
  value: React.ReactNode
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
        {label}
      </span>
      <span className="font-mono text-foreground tabular-nums">{value}</span>
    </div>
  )
}

/** §3 Share of energy per source. */
export function SourceDonut({ sources }: { sources: Source[] }) {
  const config: ChartConfig = Object.fromEntries(
    sources.map((s) => [s.key, { label: s.label, color: s.color }])
  )
  const data = sources
    .filter((s) => s.kwh > 0)
    .map((s) => ({ ...s, fill: s.color }))
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <ChartContainer
        config={config}
        className="aspect-square size-52 shrink-0"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_v, _n, item) => (
                  <TooltipRow
                    color={item.payload.color}
                    label={item.payload.label}
                    value={`${formatNumber(item.payload.kwh)} kWh (${formatNumber(item.payload.percent, 1)}%)`}
                  />
                )}
              />
            }
          />
          <Pie
            data={data}
            dataKey="kwh"
            nameKey="key"
            innerRadius="58%"
            outerRadius="95%"
            strokeWidth={2}
          />
        </PieChart>
      </ChartContainer>
      <SourceLegend sources={sources} />
    </div>
  )
}

export function SourceLegend({ sources }: { sources: Source[] }) {
  return (
    <ul className="flex w-full flex-col gap-2 text-sm">
      {sources.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: s.color }}
          />
          <span className="min-w-0 flex-1 truncate">{s.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {formatNumber(s.kwh)} kWh ({formatNumber(s.percent, 1)}%)
          </span>
        </li>
      ))}
    </ul>
  )
}

/** §4 Top contributors, horizontal bars. */
export function TopContributorsChart({ sources }: { sources: Source[] }) {
  const config: ChartConfig = { kwh: { label: "Energy" } }
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: Math.max(120, sources.length * 44) }}
    >
      <BarChart
        data={sources}
        layout="vertical"
        margin={{ left: 0, right: 16 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_v, _n, item) => (
                <TooltipRow
                  color={item.payload.color}
                  label={item.payload.label}
                  value={`${formatNumber(item.payload.kwh)} kWh`}
                />
              )}
            />
          }
        />
        <Bar dataKey="kwh" radius={999} barSize={24}>
          {sources.map((s) => (
            <Cell key={s.key} fill={s.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** §5b Battery: energy and discharge-time bars, max SOC line. */
export function BatteryChart({
  battery,
}: {
  battery: NonNullable<MonthlyReportModel["battery"]>
}) {
  const config: ChartConfig = {
    energyKwh: { label: "Energy provided (kWh)", color: "var(--chart-1)" },
    hours: { label: "Discharge duration (hours)", color: "var(--chart-3)" },
    maxSoc: { label: "Max SOC (%)", color: "var(--chart-5)" },
  }
  // Tick on the first and last day and every 5th day.
  const ticks = battery.points
    .filter(
      (p, i) =>
        i === 0 || i === battery.points.length - 1 || Number(p.day) % 5 === 0
    )
    .map((p) => p.day)
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <ComposedChart data={battery.points} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          ticks={ticks}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
        />
        <YAxis
          yAxisId="kwh"
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0)}
        />
        <YAxis yAxisId="hours" hide domain={[0, battery.hoursAxisMax]} />
        <YAxis
          yAxisId="soc"
          orientation="right"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
              formatter={(value, name, item) => (
                <TooltipRow
                  color={item.color}
                  label={config[String(name)]?.label}
                  value={
                    name === "hours"
                      ? formatHours(Number(value))
                      : name === "maxSoc"
                        ? `${formatNumber(Number(value), 0)}%`
                        : `${formatNumber(Number(value), 1)} kWh`
                  }
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        <Bar
          yAxisId="kwh"
          dataKey="energyKwh"
          fill="var(--color-energyKwh)"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          yAxisId="hours"
          dataKey="hours"
          fill="var(--color-hours)"
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="soc"
          dataKey="maxSoc"
          stroke="var(--color-maxSoc)"
          strokeWidth={2}
          dot={false}
          type="monotone"
        />
      </ComposedChart>
    </ChartContainer>
  )
}

/** §6a Min / average / max demand per operating segment. */
export function PowerDemandChart({
  demand,
}: {
  demand: MonthlyReportModel["powerDemand"]
}) {
  const config: ChartConfig = {
    min: { label: "Min", color: "var(--chart-4)" },
    average: { label: "Average", color: "var(--chart-2)" },
    max: { label: "Max", color: "var(--chart-1)" },
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={demand.rows} margin={{ left: 4, right: 4 }}>
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
          width={44}
          tickFormatter={(v: number) => formatNumber(v, 0)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <TooltipRow
                  color={item.color}
                  label={config[String(name)]?.label}
                  value={`${formatNumber(Number(value), 1)} ${item.payload.unit}`}
                />
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="min"
          fill="var(--color-min)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="average"
          fill="var(--color-average)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="max"
          fill="var(--color-max)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  )
}

/** §7d Utility supply: hours supplied vs blackout hours. */
export function BandDonut({
  bands,
}: {
  bands: NonNullable<MonthlyReportModel["bands"]>
}) {
  const config: ChartConfig = {
    supplied: { label: "Utility supply", color: "var(--chart-1)" },
    blackout: { label: "Blackout", color: "var(--chart-4)" },
  }
  const data = [
    {
      key: "supplied",
      hours: bands.suppliedHours,
      fill: "var(--color-supplied)",
    },
    {
      key: "blackout",
      hours: bands.blackoutHours,
      fill: "var(--color-blackout)",
    },
  ]
  return (
    <ChartContainer config={config} className="aspect-square size-56">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _n, item) => (
                <TooltipRow
                  color={item.payload.fill}
                  label={config[item.payload.key]?.label}
                  value={`${formatNumber(Number(value))} h`}
                />
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="hours"
          nameKey="key"
          innerRadius="58%"
          outerRadius="95%"
          strokeWidth={2}
        />
        <ChartLegend
          content={<ChartLegendContent nameKey="key" className="flex-wrap" />}
        />
      </PieChart>
    </ChartContainer>
  )
}
