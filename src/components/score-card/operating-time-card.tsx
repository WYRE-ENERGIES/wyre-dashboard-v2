"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useFilters } from "@/components/filters-provider"
import { useScoreCardQuery } from "@/components/score-card/use-score-card-data"
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatHours, formatNaira, formatNumber } from "@/lib/format"
import { periodLabel } from "@/lib/period"
import { operatingTime, scoreCardDevices } from "@/lib/score-card/metrics"

const config: ChartConfig = {
  hours: { label: "Time outside operating hours", color: "var(--chart-1)" },
}

const X_LABEL = { hourly: "Hour", daily: "Day", monthly: "Month" } as const

export function OperatingTimeCard() {
  const { period, selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("operating-time")
  const data = query.data
    ? operatingTime(scoreCardDevices(query.data, selectedDeviceIds), period)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating time deviation</CardTitle>
        <CardDescription>
          Generator time outside official operating hours ·{" "}
          {periodLabel(period)}
        </CardDescription>
        <CardAction>
          <InfoHint>
            Each period generators ran outside official hours, with the energy,
            diesel and cost that time used.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isPending ? (
          <>
            <Skeleton className="h-12 w-full max-w-xl" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : !data ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No generators in the current selection.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ["Total time", formatHours(data.totalHours)],
                  ["Energy wasted", `${formatNumber(data.totalEnergyKwh)} kWh`],
                  [
                    "Diesel wasted",
                    `${formatNumber(data.totalDieselLitres)} L`,
                  ],
                  ["Estimated cost", formatNaira(data.totalCostNaira)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-heading text-lg font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {data.points.length === 0 ? (
              <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No operating-time data for this period.
              </p>
            ) : (
              <ChartContainer
                config={config}
                className="aspect-auto h-64 w-full"
              >
                <BarChart data={data.points} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={8}
                    label={{
                      value: X_LABEL[data.resolution],
                      position: "insideBottom",
                      offset: -4,
                    }}
                    height={40}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(v: number) => formatNumber(v, 1)}
                    label={{
                      value: "Hours",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.tooltipLabel ?? ""
                        }
                        formatter={(value, _name, item) => (
                          <div className="flex w-full flex-col gap-0.5">
                            <span className="text-muted-foreground">
                              Outside operating hours
                            </span>
                            <span className="font-mono text-foreground tabular-nums">
                              {formatHours(Number(value))} ·{" "}
                              {formatNumber(item.payload.energyKwh)} kWh
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="hours"
                    fill="var(--color-hours)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
