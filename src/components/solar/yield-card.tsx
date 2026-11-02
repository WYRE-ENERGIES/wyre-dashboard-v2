"use client"

import { ArrowDownToLineIcon, ArrowUpFromLineIcon } from "lucide-react"

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { SolarYield, YieldBucketKey } from "@/lib/api/solar-types"
import { formatNumber } from "@/lib/format"
import { periodLabel } from "@/lib/period"
import { formatDemandAt } from "@/lib/solar/metrics"

type EnergyTab = "generation" | "load" | "grid"

/** Row labels when showing all-time totals (production's unfiltered view). */
const ALL_TIME_LABELS: Record<EnergyTab, Record<YieldBucketKey, string>> = {
  generation: {
    total: "Total yield",
    today: "Today's yield",
    monthly: "This month's yield",
  },
  load: {
    total: "Consumption",
    today: "Today's energy",
    monthly: "This month",
  },
  grid: { total: "Import", today: "Today's energy", monthly: "This month" },
}

const naira0 = (v: number) => `₦${formatNumber(v, 0)}`

/**
 * Energy summary (old EnergySummary + 07 §2.3): Generation, Battery, Load,
 * Grid and Power demand for the selected period. Production's own day/month
 * yield filter is replaced by the global period; "All time" keeps its
 * unfiltered view (total, today, this month).
 */
export function YieldCard({
  data,
  allTime,
  onAllTimeChange,
}: {
  data: SolarData
  allTime: boolean
  onAllTimeChange: (allTime: boolean) => void
}) {
  const query = data.summary
  const y = query.data
  const windowLabel = y?.windowLabel ?? periodLabel(data.period)
  const rows: Array<{ key: YieldBucketKey; label?: string }> = allTime
    ? [{ key: "total" }, { key: "today" }, { key: "monthly" }]
    : [{ key: "total", label: windowLabel }]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Energy summary</CardTitle>
        <CardDescription>
          {allTime ? "All time, today and this month" : windowLabel}
        </CardDescription>
        <CardAction>
          <InfoHint>
            Energy produced, stored, used and imported, with its value in naira.
            {data.period.kind === "year" &&
              !allTime &&
              " A year is added up from its months."}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ToggleGroup
          value={[allTime ? "all" : "period"]}
          onValueChange={(value: string[]) =>
            value[0] && onAllTimeChange(value[0] === "all")
          }
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Summary scope"
        >
          <ToggleGroupItem value="period">Selected period</ToggleGroupItem>
          <ToggleGroupItem value="all">All time</ToggleGroupItem>
        </ToggleGroup>
        {query.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : query.isError || !y ? (
          <CardError onRetry={() => query.refetch()} />
        ) : (
          <Tabs defaultValue="generation">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList>
                <TabsTrigger value="generation">Generation</TabsTrigger>
                <TabsTrigger value="battery">Battery</TabsTrigger>
                <TabsTrigger value="load">Load</TabsTrigger>
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="demand">Power demand</TabsTrigger>
              </TabsList>
            </div>
            {(["generation", "load", "grid"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <dl className="flex flex-col divide-y">
                  {rows.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                    >
                      <dt className="text-muted-foreground">
                        {label ?? ALL_TIME_LABELS[tab][key]}
                      </dt>
                      <dd className="flex gap-4 tabular-nums">
                        <span className="font-medium">
                          {formatNumber(y[tab][key].kwh, 0)} kWh
                        </span>
                        <span className="text-muted-foreground">
                          {naira0(y[tab][key].cost)}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>
            ))}
            <TabsContent value="battery">
              <BatteryRows y={y} rows={rows} allTime={allTime} />
            </TabsContent>
            <TabsContent value="demand">
              <DemandRows
                y={y}
                rows={
                  allTime
                    ? [{ key: "today" }, { key: "monthly" }, { key: "total" }]
                    : rows
                }
                timeOnly={!allTime && data.period.kind === "day"}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

const BATTERY_LABELS: Record<YieldBucketKey, string> = {
  total: "Total",
  today: "Today",
  monthly: "This month",
}

/** Battery tab (07 §2.3): charged in / discharged out in kWh; ₦ removed. */
function BatteryRows({
  y,
  rows,
  allTime,
}: {
  y: SolarYield
  rows: Array<{ key: YieldBucketKey; label?: string }>
  allTime: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2.5 text-sm sm:gap-x-8">
        <span />
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowDownToLineIcon className="size-3.5 text-primary" aria-hidden />{" "}
          Charged
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowUpFromLineIcon className="size-3.5 text-chart-3" aria-hidden />{" "}
          Discharged
        </span>
        {rows.map(({ key, label }) => (
          <div key={key} className="contents">
            <span className="flex min-w-0 flex-col">
              <span className="text-muted-foreground">
                {label ?? BATTERY_LABELS[key]}
              </span>
              {allTime && key === "total" && y.batterySince && (
                <span className="text-xs text-muted-foreground/80">
                  {y.batterySince}
                </span>
              )}
            </span>
            <span className="text-right font-medium tabular-nums">
              {formatNumber(y.battery[key].chargeKwh, 1)} kWh
            </span>
            <span className="text-right font-medium tabular-nums">
              {formatNumber(y.battery[key].dischargeKwh, 1)} kWh
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Charged is energy stored into the battery; discharged is energy
        delivered from it.
      </p>
    </div>
  )
}

/** Power demand tab (07 §2.3): max / min / avg kW, with when max and min
 * happened. */
function DemandRows({
  y,
  rows,
  timeOnly,
}: {
  y: SolarYield
  rows: Array<{ key: YieldBucketKey; label?: string }>
  timeOnly: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-2.5 text-sm sm:gap-x-6">
      <span />
      <span className="text-right text-xs font-medium text-muted-foreground">
        Max
      </span>
      <span className="text-right text-xs font-medium text-muted-foreground">
        Min
      </span>
      <span className="text-right text-xs font-medium text-muted-foreground">
        Avg
      </span>
      {rows.map(({ key, label }) => {
        const d = y.demand[key]
        const maxAt = formatDemandAt(d.maxAt, timeOnly || key === "today")
        const minAt = formatDemandAt(d.minAt, timeOnly || key === "today")
        return (
          <div key={key} className="contents">
            <span className="min-w-0 truncate text-muted-foreground">
              {label ?? BATTERY_LABELS[key]}
            </span>
            <DemandCell kw={d.maxKw} at={maxAt} />
            <DemandCell kw={d.minKw} at={minAt} />
            <DemandCell kw={d.avgKw} at={null} />
          </div>
        )
      })}
    </div>
  )
}

function DemandCell({ kw, at }: { kw: number; at: string | null }) {
  return (
    <span className="flex flex-col items-end">
      <span className="font-medium tabular-nums">{formatNumber(kw, 3)} kW</span>
      {at && <span className="text-xs text-muted-foreground">{at}</span>}
    </span>
  )
}
