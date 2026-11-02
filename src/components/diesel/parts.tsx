"use client"

import { format } from "date-fns"
import { Cell, Label, Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { GeneratorRef } from "@/lib/api/diesel-types"
import { seriesColors } from "@/lib/dashboard/colors"
import { formatDeviceName } from "@/lib/format"
import { periodLabel, type Period } from "@/lib/period"

/**
 * Description line for a card. Cards whose endpoint only has whole months
 * say so when a Day is selected, instead of silently showing the month.
 */
export function scopeText(period: Period, monthOnly = false) {
  if (monthOnly && period.kind === "day")
    return `${format(period.anchor, "MMMM yyyy")} (whole month)`
  return periodLabel(period)
}

export const MONTH_ONLY_HINT =
  "This figure is only available per month, so a selected day shows its whole month."

export const BRANCH_WIDE_HINT =
  "Branch-wide figure: the device filter doesn't apply to it."

/** Chart keys and purple shades for a list of generators. Sorted by name so
 * a generator keeps its colour across cards fed by different endpoints. */
export function generatorPalette<T extends GeneratorRef>(rows: T[]) {
  const colors = seriesColors(rows.map(() => ({ device_type: "GENERATOR" })))
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row, index) => ({
      ...row,
      key: `g${index}`,
      label: formatDeviceName(row.name),
      color: colors[index],
    }))
}

export type DonutRow = {
  key: string
  label: string
  value: number
  color: string
}

/** Doughnut with a centre label; shows a muted ring when everything is 0. */
export function Donut({
  rows,
  centerTop,
  centerBottom,
  formatValue,
  className = "aspect-square h-44",
}: {
  rows: DonutRow[]
  centerTop: string
  centerBottom: string
  formatValue: (value: number) => string
  className?: string
}) {
  const total = rows.reduce((a, r) => a + r.value, 0)
  const data = total
    ? rows
    : [{ key: "none", label: "No data", value: 1, color: "var(--muted)" }]
  const config: ChartConfig = Object.fromEntries(
    rows.map((r) => [r.key, { label: r.label, color: r.color }])
  )

  return (
    <ChartContainer config={config} className={className}>
      <PieChart>
        {total > 0 && (
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono tabular-nums">
                      {formatValue(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
        )}
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="62%"
          strokeWidth={3}
        >
          {data.map((r) => (
            <Cell key={r.key} fill={r.color} />
          ))}
          <Label
            content={({ viewBox }) =>
              viewBox && "cx" in viewBox ? (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) - 6}
                    className="fill-foreground text-base font-semibold"
                  >
                    {centerTop}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 14}
                    className="fill-muted-foreground text-xs"
                  >
                    {centerBottom}
                  </tspan>
                </text>
              ) : null
            }
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

export function Legend({
  rows,
  formatValue,
}: {
  rows: DonutRow[]
  formatValue: (value: number) => string
}) {
  return (
    <ul className="flex w-full min-w-0 flex-col gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: r.color }}
          />
          <span className="truncate">{r.label}</span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {formatValue(r.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function EmptyNote({
  children,
  className = "h-44",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`flex items-center justify-center text-center text-sm text-muted-foreground ${className}`}
    >
      {children}
    </p>
  )
}
