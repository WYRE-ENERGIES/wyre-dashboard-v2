"use client"

import { Cell, Label, Pie, PieChart } from "recharts"

import { CardError, InfoHint } from "@/components/shared/card-parts"
import type { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { seriesColors } from "@/lib/dashboard/colors"
import { sourceUsage } from "@/lib/dashboard/metrics"
import { formatDeviceName, formatHours, formatPercent } from "@/lib/format"

/** Hours each source was in use (the old "Power Usage (Hours/Month)" doughnut). */
export function UsageHoursChart({
  data,
}: {
  data: ReturnType<typeof useDashboardData>
}) {
  const { selectedDeviceIds } = useFilters()
  const query = data.deviceUsage
  const sources = sourceUsage(query.data, selectedDeviceIds)
  const total = sources.reduce((acc, s) => acc + s.hours, 0)

  const colors = seriesColors(sources)
  const rows = sources.map((s, index) => ({
    key: `d${s.deviceId}`,
    name: formatDeviceName(s.name),
    hours: s.hours,
    fill: colors[index],
  }))
  const config: ChartConfig = Object.fromEntries(
    rows.map((r) => [r.key, { label: r.name, color: r.fill }])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours of use</CardTitle>
        <CardDescription>How long each source supplied power</CardDescription>
        <CardAction>
          <InfoHint>
            Number of hours each source of energy was in use over the selected
            period.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="mx-auto size-48 rounded-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartContainer
              config={config}
              className="aspect-square h-48 shrink-0"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono tabular-nums">
                            {formatHours(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={
                    total
                      ? rows
                      : [
                          {
                            key: "none",
                            name: "No use",
                            hours: 1,
                            fill: "var(--muted)",
                          },
                        ]
                  }
                  dataKey="hours"
                  nameKey="name"
                  innerRadius={56}
                  strokeWidth={4}
                >
                  {(total ? rows : [{ key: "none", fill: "var(--muted)" }]).map(
                    (r) => (
                      <Cell key={r.key} fill={r.fill} />
                    )
                  )}
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
                            y={viewBox.cy}
                            className="fill-foreground text-lg font-semibold"
                          >
                            {Math.round(total)} h
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 18}
                            className="fill-muted-foreground text-xs"
                          >
                            total
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex w-full flex-col gap-2 text-sm">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ background: r.fill }}
                  />
                  <span className="truncate">{r.name}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {formatHours(r.hours)} · {formatPercent(r.hours, total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
