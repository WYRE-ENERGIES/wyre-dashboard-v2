"use client"

import { useFilters } from "@/components/filters-provider"
import { RatingBadge, RingGauge } from "@/components/score-card/ring-gauge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { formatDeviceName, formatHours, formatNumber } from "@/lib/format"
import {
  fuelEfficiency,
  generatorSizeEfficiency,
  scoreCardDevices,
} from "@/lib/score-card/metrics"

const HINTS = {
  size: "Scores how well each generator's size matches the power the facility demands. 36–51% load is fairly efficient, 51–70% efficient, above 70% overloaded.",
  fuel: "Average kWh per litre, from the diesel the facility consumed, benchmarked against a well-maintained, well-sized diesel generator.",
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

const NoGenerators = () => (
  <p className="flex min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
    No generators in the current selection.
  </p>
)

/** "GEN 275kVA" — the size is appended only when the name doesn't already carry it. */
const title = (name: string, size: string) =>
  size && !name.toLowerCase().includes(size.toLowerCase())
    ? `${formatDeviceName(name)} (${size})`
    : formatDeviceName(name)

export function GeneratorSizeCard() {
  const { selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("generator-size-efficiency")
  const generators = query.data
    ? generatorSizeEfficiency(scoreCardDevices(query.data, selectedDeviceIds))
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generator size efficiency</CardTitle>
        <CardDescription>
          Utilisation factor for facility generators
        </CardDescription>
        <CardAction>
          <InfoHint>{HINTS.size}</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : generators.length === 0 ? (
          <NoGenerators />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {generators.map((g) => (
              <li key={g.name} className="flex items-center gap-4">
                <RingGauge
                  size={104}
                  percent={g.sizeMissing ? 0 : g.usage}
                  tone={g.tone}
                  label={
                    g.sizeMissing ? "—" : `${formatNumber(g.usage, 1)}${g.unit}`
                  }
                  caption="load"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-medium break-words">
                    {g.sizeMissing
                      ? formatDeviceName(g.name)
                      : title(g.name, g.size)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {g.sizeMissing
                      ? "Add its rated kVA to score the loading"
                      : `${formatNumber(g.usage)}${g.unit} of capacity`}
                  </span>
                  <RatingBadge tone={g.tone}>{g.message}</RatingBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function FuelEfficiencyCard() {
  const { selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("fuel-consumption")
  const generators = query.data
    ? fuelEfficiency(scoreCardDevices(query.data, selectedDeviceIds))
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuel efficiency</CardTitle>
        <CardDescription>
          Estimated fuel consumption for facility generators
        </CardDescription>
        <CardAction>
          <InfoHint>{HINTS.fuel}</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : generators.length === 0 ? (
          <NoGenerators />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {generators.map((g) => (
              <li key={g.name} className="flex items-center gap-4">
                <RingGauge
                  size={104}
                  percent={g.percentOfBenchmark}
                  label={formatNumber(g.current, 2)}
                  caption="kWh/L"
                />
                <div className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="font-medium break-words">
                    {title(g.name, g.size)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(g.dieselLitres)} litres
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatHours(g.hours)} running
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Benchmark {formatNumber(g.baseline, 2)} kWh/L
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
