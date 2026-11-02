"use client"

import { useQuery } from "@tanstack/react-query"
import { SunIcon } from "lucide-react"

import {
  CardError,
  InfoHint,
  Stat,
  statCardClass,
  ValueSkeleton,
} from "@/components/shared/card-parts"
import type { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSideBar } from "@/lib/api/endpoints"
import { demandSummary, totalEnergy } from "@/lib/dashboard/metrics"
import { formatNumber, formatPercent } from "@/lib/format"
import { showsSolarHoursLine } from "@/lib/gating"

type Data = ReturnType<typeof useDashboardData>

export function KpiCards({ data }: { data: Data }) {
  const claims = useClaims()
  const { selectedDeviceIds } = useFilters()
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })

  const energy = totalEnergy(data.totalEnergy.data, selectedDeviceIds)
  // branch_demand identifies devices by name only.
  const selectedNames = selectedDeviceIds.length
    ? (sideBar.data?.authenticatedData.branches[0]?.devices ?? [])
        .filter((d) => selectedDeviceIds.includes(d.device_id))
        .map((d) => d.name)
    : null
  const demand = demandSummary(data.demand.data, selectedNames)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="bg-primary text-primary-foreground ring-0">
        <CardHeader>
          <CardDescription className="text-primary-foreground/80">
            Total energy
          </CardDescription>
          <CardAction>
            <InfoHint className="text-primary-foreground/70 hover:text-primary-foreground">
              Energy used by the building over the selected period, from all
              sources. Solar hours is the energy used between 8am and 6pm, when
              the sun is expected to be out.
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {data.totalEnergy.isPending ? (
            <ValueSkeleton className="bg-primary-foreground/20" />
          ) : data.totalEnergy.isError ? (
            <CardError
              onRetry={() => data.totalEnergy.refetch()}
              className="text-primary-foreground/80"
            />
          ) : (
            <>
              <Stat
                value={formatNumber(energy.totalKwh)}
                unit="kWh"
                className="text-3xl"
              />
              {showsSolarHoursLine(claims) && (
                <span className="flex items-center gap-1.5 text-sm text-primary-foreground/80">
                  <SunIcon
                    className="size-4 shrink-0 text-highlight"
                    aria-hidden
                  />
                  {formatNumber(energy.solarHoursKwh)} kWh in solar hours (
                  {formatPercent(energy.solarHoursKwh, energy.totalKwh)})
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className={statCardClass}>
        <CardHeader>
          <CardDescription>Power demand</CardDescription>
          <CardAction>
            <InfoHint>
              Maximum, minimum and average power demand of the building. Use it
              to size generators or plan efficient load operation.
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          {data.demand.isPending ? (
            <ValueSkeleton className="w-full" />
          ) : data.demand.isError ? (
            <CardError onRetry={() => data.demand.refetch()} />
          ) : (
            <dl className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Max", demand.max],
                  ["Min", demand.min],
                  ["Avg", demand.avg],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="flex flex-col">
                    <Stat
                      value={formatNumber(value, 1)}
                      className="truncate text-xl"
                    />
                    <span className="text-xs text-muted-foreground">kVA</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className={statCardClass}>
        <CardHeader>
          <CardDescription>Carbon emissions</CardDescription>
        </CardHeader>
        <CardContent>
          {data.totalEnergy.isPending ? (
            <ValueSkeleton />
          ) : data.totalEnergy.isError ? (
            <CardError onRetry={() => data.totalEnergy.refetch()} />
          ) : (
            <Stat value={formatNumber(energy.carbonTons)} unit="tons" />
          )}
        </CardContent>
      </Card>

      <Card className={statCardClass}>
        <CardHeader>
          <CardDescription>Blended cost of energy</CardDescription>
          <CardAction>
            <InfoHint>
              The average cost of a kWh across all sources over the selected
              period.
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          {data.blendedCost.isPending ? (
            <ValueSkeleton />
          ) : data.blendedCost.isError ? (
            <CardError onRetry={() => data.blendedCost.refetch()} />
          ) : (
            <Stat
              value={`₦${formatNumber(data.blendedCost.data?.data)}`}
              unit="per kWh"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function TodayYesterdayCard({ data }: { data: Data }) {
  const { selectedDeviceIds } = useFilters()
  const energy = totalEnergy(data.totalEnergy.data, selectedDeviceIds)
  const change = energy.yesterdayKwh
    ? (energy.todayKwh - energy.yesterdayKwh) / energy.yesterdayKwh
    : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today vs yesterday</CardTitle>
        <CardDescription>
          Energy used so far today, against all of yesterday.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.totalEnergy.isPending ? (
          <ValueSkeleton className="h-20 w-full" />
        ) : data.totalEnergy.isError ? (
          <CardError onRetry={() => data.totalEnergy.refetch()} />
        ) : (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted-foreground">Today</dt>
              <dd>
                <Stat value={formatNumber(energy.todayKwh)} unit="kWh" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Yesterday</dt>
              <dd>
                <Stat value={formatNumber(energy.yesterdayKwh)} unit="kWh" />
              </dd>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              {energy.yesterdayKwh
                ? `${change >= 0 ? "Up" : "Down"} ${formatNumber(Math.abs(change) * 100, 1)}% on yesterday`
                : "No usage recorded yesterday."}
            </p>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
