"use client"

import { FuelIcon, LeafIcon, PowerIcon } from "lucide-react"

import {
  BRANCH_WIDE_HINT,
  MONTH_ONLY_HINT,
  scopeText,
} from "@/components/diesel/parts"
import type { DieselData } from "@/components/diesel/use-diesel-data"
import { useFilters } from "@/components/filters-provider"
import {
  CardError,
  InfoHint,
  Stat,
  statCardClass,
  ValueSkeleton,
} from "@/components/shared/card-parts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { selectGenerators } from "@/lib/diesel/metrics"
import { formatDeviceName, formatNaira, formatNumber } from "@/lib/format"
import { isDayView } from "@/lib/period"
import { cn } from "@/lib/utils"

/** Old DieselHeader.js: generator state, CO₂, diesel price block. */
export function DieselHeaderCards({ data }: { data: DieselData }) {
  const { selectedDeviceIds } = useFilters()
  const generators = selectGenerators(
    data.status.data ?? [],
    selectedDeviceIds,
    data.devices
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card className={statCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PowerIcon className="size-4 text-muted-foreground" aria-hidden />
            Generators
          </CardTitle>
          <CardDescription>Current state</CardDescription>
        </CardHeader>
        <CardContent>
          {data.status.isPending ? (
            <ValueSkeleton className="h-12 w-full" />
          ) : data.status.isError ? (
            <CardError onRetry={() => data.status.refetch()} />
          ) : generators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generators in the current selection.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {generators.map((g) => (
                <li
                  key={`${g.deviceId ?? ""}${g.name}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      g.isOn
                        ? "bg-highlight ring-4 ring-highlight/30"
                        : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {formatDeviceName(g.name)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {g.lastUsed ? `Last used ${g.lastUsed}` : "No recent use"}
                    </span>
                  </span>
                  <Badge
                    variant={g.isOn ? "default" : "outline"}
                    className={cn(
                      g.isOn && "bg-highlight text-highlight-foreground"
                    )}
                  >
                    {g.isOn ? "Running" : "Off"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={statCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LeafIcon className="size-4 text-muted-foreground" aria-hidden />
            CO₂ emissions
          </CardTitle>
          <CardDescription>{scopeText(data.period, true)}</CardDescription>
          <CardAction>
            <InfoHint>
              Carbon dioxide released by the generators.{" "}
              {isDayView(data.period) && MONTH_ONLY_HINT} {BRANCH_WIDE_HINT}
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          {data.co2.isPending ? (
            <ValueSkeleton />
          ) : data.co2.isError ? (
            <CardError onRetry={() => data.co2.refetch()} />
          ) : (
            <Stat value={formatNumber(data.co2.data, 3)} unit="tonnes" />
          )}
        </CardContent>
      </Card>

      <Card className={cn(statCardClass, "md:col-span-2 xl:col-span-1")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FuelIcon className="size-4 text-muted-foreground" aria-hidden />
            Diesel
          </CardTitle>
          <CardDescription>
            Current price and this month&apos;s estimate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.price.isPending ? (
            <ValueSkeleton className="h-16 w-full" />
          ) : data.price.isError ? (
            <CardError onRetry={() => data.price.refetch()} />
          ) : (
            <dl className="grid gap-2 text-sm">
              <Row
                label="Price per litre"
                value={formatNaira(data.price.data.pricePerLitre)}
              />
              <Row
                label="Diesel efficiency"
                value={`${formatNumber(data.price.data.efficiencyKwhPerLitre)} kWh/L`}
              />
              <Row
                label="Estimated cost this month"
                value={formatNaira(data.price.data.monthEstimatedCost)}
              />
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-heading font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
