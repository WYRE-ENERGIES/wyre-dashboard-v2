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
import type { SolarYield, YieldBucketKey } from "@/lib/api/solar-types"
import { formatNumber } from "@/lib/format"
import { periodLabel } from "@/lib/period"
import { formatDemandAt } from "@/lib/solar/metrics"

const naira0 = (v: number) => `₦${formatNumber(v, 0)}`

/**
 * Energy summary (old EnergySummary + 07 §2.3): Generation, Battery, Load,
 * Grid and Power demand for the page's period. Production's own day/month
 * yield filter (and its "All time" view) is replaced by the global period.
 */
export function YieldCard({ data }: { data: SolarData }) {
  const query = data.summary
  const y = query.data
  const windowLabel = y?.windowLabel ?? periodLabel(data.period)
  const rows: Array<{ key: YieldBucketKey; label: string }> = [
    { key: "total", label: windowLabel },
  ]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Energy summary</CardTitle>
        <CardDescription>{windowLabel}</CardDescription>
        <CardAction>
          <InfoHint>
            Energy produced, stored, used and imported, with its value in naira.
            {data.period.kind === "year" &&
              " A year is added up from its months."}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
                      <dt className="text-muted-foreground">{label}</dt>
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
              <BatteryRows y={y} rows={rows} />
            </TabsContent>
            <TabsContent value="demand">
              <DemandRows
                y={y}
                rows={rows}
                timeOnly={data.period.kind === "day"}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

/** Battery tab (07 §2.3): charged in / discharged out in kWh; ₦ removed. */
function BatteryRows({
  y,
  rows,
}: {
  y: SolarYield
  rows: Array<{ key: YieldBucketKey; label: string }>
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
            <span className="min-w-0 text-muted-foreground">{label}</span>
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
  rows: Array<{ key: YieldBucketKey; label: string }>
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
              {label}
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
