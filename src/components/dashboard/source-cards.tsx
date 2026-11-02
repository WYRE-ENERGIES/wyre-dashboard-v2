"use client"

import {
  FactoryIcon,
  FuelIcon,
  SunIcon,
  UtilityPoleIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import { CardError, statCardClass } from "@/components/shared/card-parts"
import type { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { sourceUsage } from "@/lib/dashboard/metrics"
import {
  formatDeviceName,
  formatHours,
  formatNaira,
  formatNumber,
} from "@/lib/format"

const ICONS: Record<string, LucideIcon> = {
  UTILITY: UtilityPoleIcon,
  GENERATOR: FuelIcon,
  SOLAR: SunIcon,
  IPP: FactoryIcon,
}

/** One card per energy source: kWh, hours of use, and cost when billed. */
export function SourceCards({
  data,
}: {
  data: ReturnType<typeof useDashboardData>
}) {
  const { selectedDeviceIds } = useFilters()
  const query = data.deviceUsage

  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-3">
      <h2 id="sources-heading" className="font-heading text-base font-medium">
        Energy sources
      </h2>
      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className={statCardClass}>
          <CardContent>
            <CardError onRetry={() => query.refetch()} />
          </CardContent>
        </Card>
      ) : (
        <SourceGrid sources={sourceUsage(query.data, selectedDeviceIds)} />
      )}
    </section>
  )
}

function SourceGrid({ sources }: { sources: ReturnType<typeof sourceUsage> }) {
  if (!sources.length) {
    return (
      <Card className={statCardClass}>
        <CardContent className="text-sm text-muted-foreground">
          None of the selected devices is an energy source.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {sources.map((source) => {
        const Icon = ICONS[source.deviceType] ?? ZapIcon
        return (
          <Card key={source.deviceId} size="sm" className={statCardClass}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/25">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate">
                    {formatDeviceName(source.name)}
                  </CardTitle>
                  <CardDescription className="capitalize">
                    {source.deviceType.toLowerCase()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="font-heading text-xl font-semibold tabular-nums">
                {formatNumber(source.kwh)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  kWh
                </span>
              </span>
              <span className="flex justify-between text-xs text-muted-foreground">
                <span>{formatHours(source.hours)} of use</span>
                {source.naira !== null && (
                  <span>{formatNaira(source.naira)}</span>
                )}
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
