"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { isSameDay, isSameMonth } from "date-fns"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SolarYield } from "@/lib/api/solar-types"
import { formatNumber } from "@/lib/format"
import { periodLabel } from "@/lib/period"
import { formatDemandAt } from "@/lib/solar/metrics"
import { cn } from "@/lib/utils"

type Row = {
  key: string
  label: string
  /** Dates under the label (the selected period). */
  sub?: string
  query: UseQueryResult<SolarYield>
  /** Times only for max/min demand (a single day). */
  timeOnly: boolean
  /** Which of the old card's three rows this is: period, today, month. */
  slot: 0 | 1 | 2
}

const ENERGY_TABS = [
  {
    value: "generation",
    labels: ["Total yield", "Today's yield", "Current month's yield"],
  },
  {
    value: "load",
    labels: ["Consumption", "Today's energy", "Current month"],
  },
  { value: "grid", labels: ["Import", "Today's energy", "Current month"] },
] as const

/**
 * Energy summary, laid out like the old dashboard's card: Generation,
 * Battery, Load, Grid and Power demand, each for the selected period, today
 * and the current month. The card has no filter of its own: the period comes
 * from the global picker (the old card's All time / D / M / calendar control
 * is replaced by it).
 */
export function YieldCard({ data }: { data: SolarData }) {
  const now = new Date()
  const { period } = data
  const isToday = period.kind === "day" && isSameDay(period.anchor, now)
  const isThisMonth = period.kind === "month" && isSameMonth(period.anchor, now)
  const windowLabel = data.summary.data?.windowLabel ?? periodLabel(period)

  // The selected period, today and this month, in the old card's order,
  // without repeating a row when the selection already is today or this
  // month.
  const rows: Row[] = (
    [
      {
        key: "period",
        label: isToday ? "Today" : isThisMonth ? "Current month" : "Selected",
        sub: windowLabel,
        query: data.summary,
        timeOnly: period.kind === "day",
        slot: isToday ? 1 : isThisMonth ? 2 : 0,
      },
      ...(isToday
        ? []
        : [
            {
              key: "today",
              label: "Today",
              query: data.today,
              timeOnly: true,
              slot: 1 as const,
            },
          ]),
      ...(isThisMonth
        ? []
        : [
            {
              key: "month",
              label: "Current month",
              query: data.thisMonth,
              timeOnly: false,
              slot: 2 as const,
            },
          ]),
    ] satisfies Row[]
  ).sort((a, b) => a.slot - b.slot)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Energy summary</CardTitle>
        <CardDescription>{windowLabel}</CardDescription>
        <CardAction>
          <InfoHint>
            Energy produced, stored, used and imported, with its value, for the
            period in the page filter, today and the current month.
            {period.kind === "year" && " A year is added up from its months."}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.summary.isError ? (
          <CardError onRetry={() => data.summary.refetch()} />
        ) : (
          <Tabs defaultValue="generation">
            <div className="-mx-1 overflow-x-auto border-b px-1">
              <TabsList variant="line" className="h-10">
                {[
                  ["generation", "Generation"],
                  ["battery", "Battery"],
                  ["load", "Load"],
                  ["grid", "Grid"],
                  ["demand", "Power demand"],
                ].map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="px-3 after:bg-brand data-active:text-brand"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {ENERGY_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <dl className="flex flex-col">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4"
                    >
                      <RowLabel label={tab.labels[row.slot]} sub={row.sub} />
                      <dd className="flex items-baseline gap-6 tabular-nums">
                        <Value query={row.query}>
                          {(y) => (
                            <>
                              <span className="text-muted-foreground">
                                {formatNumber(y[tab.value].total.kwh, 0)} kWh
                              </span>
                              <span>
                                {formatNumber(y[tab.value].total.cost, 0)}{" "}
                                <span className="font-medium text-success">
                                  NGN
                                </span>
                              </span>
                            </>
                          )}
                        </Value>
                      </dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>
            ))}

            <TabsContent value="battery">
              <BatteryTable rows={rows} />
            </TabsContent>
            <TabsContent value="demand">
              <DemandTable rows={rows} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

function RowLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <dt className="flex min-w-0 flex-col">
      <span className="font-medium">{label}</span>
      {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
    </dt>
  )
}

/** A row's figures once its query has loaded; a skeleton until then. */
function Value({
  query,
  className,
  children,
}: {
  query: UseQueryResult<SolarYield>
  /** Placement of the loading and error states (e.g. a grid span). */
  className?: string
  children: (y: SolarYield) => React.ReactNode
}) {
  if (query.isPending)
    return <Skeleton className={cn("h-5 w-32 justify-self-end", className)} />
  if (query.isError || !query.data)
    return (
      <span
        className={cn("text-right text-sm text-muted-foreground", className)}
      >
        Unavailable
      </span>
    )
  return <>{children(query.data)}</>
}

const ARROW_CHIP =
  "flex size-5 items-center justify-center rounded-md text-white [&_svg]:size-3.5"

/** Battery tab: energy charged in and discharged out, as on the old card. */
function BatteryTable({ rows }: { rows: Row[] }) {
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 sm:gap-x-12">
        <span />
        <span className="flex items-center justify-end gap-2 py-3 text-xs font-semibold tracking-wider text-chart-1 uppercase">
          <span className={cn(ARROW_CHIP, "bg-chart-1")}>
            <ArrowDownIcon aria-hidden />
          </span>
          Charged · in
        </span>
        <span className="flex items-center justify-end gap-2 py-3 text-xs font-semibold tracking-wider text-success uppercase">
          <span className={cn(ARROW_CHIP, "bg-success")}>
            <ArrowUpIcon aria-hidden />
          </span>
          Discharged · out
        </span>
        {rows.map((row) => (
          <div
            key={row.key}
            className="col-span-3 grid grid-cols-subgrid items-center border-t py-3"
          >
            <RowLabel
              label={row.slot === 0 ? "Total" : row.label}
              sub={row.sub}
            />
            <Value query={row.query} className="col-span-2">
              {(y) => (
                <>
                  <span className="text-right font-heading text-lg font-semibold text-chart-1 tabular-nums">
                    {formatNumber(y.battery.total.chargeKwh, 1)} kWh
                  </span>
                  <span className="text-right font-heading text-lg font-semibold text-success tabular-nums">
                    {formatNumber(y.battery.total.dischargeKwh, 1)} kWh
                  </span>
                </>
              )}
            </Value>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:gap-10">
        <span className="flex items-center gap-2">
          <span className={cn(ARROW_CHIP, "bg-chart-1")}>
            <ArrowDownIcon aria-hidden />
          </span>
          Charged = energy stored into the battery
        </span>
        <span className="flex items-center gap-2">
          <span className={cn(ARROW_CHIP, "bg-success")}>
            <ArrowUpIcon aria-hidden />
          </span>
          Discharged = energy delivered from the battery
        </span>
      </div>
    </div>
  )
}

/** Power demand tab: max (red), min (blue) and average (purple), with when
 * the max and min happened. */
function DemandTable({ rows }: { rows: Row[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-6 sm:gap-x-12">
      <span />
      <span className="py-3 text-right text-xs font-semibold tracking-wider text-destructive uppercase">
        Max
      </span>
      <span className="py-3 text-right text-xs font-semibold tracking-wider text-chart-3 uppercase">
        Min
      </span>
      <span className="py-3 text-right text-xs font-semibold tracking-wider text-chart-1 uppercase">
        Avg
      </span>
      {rows.map((row) => (
        <div
          key={row.key}
          className="col-span-4 grid grid-cols-subgrid items-center border-t py-3"
        >
          <RowLabel
            label={row.slot === 0 ? "Total" : row.label}
            sub={row.sub}
          />
          <Value query={row.query} className="col-span-3">
            {(y) => {
              const d = y.demand.total
              return (
                <>
                  <DemandCell
                    kw={d.maxKw}
                    at={formatDemandAt(d.maxAt, row.timeOnly)}
                    className="text-destructive"
                  />
                  <DemandCell
                    kw={d.minKw}
                    at={formatDemandAt(d.minAt, row.timeOnly)}
                    className="text-chart-3"
                  />
                  <DemandCell kw={d.avgKw} at={null} className="text-chart-1" />
                </>
              )
            }}
          </Value>
        </div>
      ))}
    </div>
  )
}

function DemandCell({
  kw,
  at,
  className,
}: {
  kw: number
  at: string | null
  className: string
}) {
  return (
    <span className="flex flex-col items-end">
      <span className="tabular-nums">
        <span className={cn("font-heading text-lg font-semibold", className)}>
          {formatNumber(kw, 3)}
        </span>{" "}
        <span className="text-sm text-muted-foreground">kW</span>
      </span>
      {at && <span className="text-xs text-muted-foreground">{at}</span>}
    </span>
  )
}
