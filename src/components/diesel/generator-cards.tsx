"use client"

import {
  Donut,
  EmptyNote,
  generatorPalette,
  Legend,
  MONTH_ONLY_HINT,
  scopeText,
} from "@/components/diesel/parts"
import type { DieselData } from "@/components/diesel/use-diesel-data"
import { useFilters } from "@/components/filters-provider"
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
import { selectGenerators, sumNumbers } from "@/lib/diesel/metrics"
import { formatHours, formatNumber } from "@/lib/format"
import { isDayView } from "@/lib/period"

const kwh = (v: number) => `${formatNumber(v, 1)} kWh`
const litres = (v: number) => `${formatNumber(v, 1)} L`

/** Old TotalEnergyUsed.js: energy per generator, total in the centre. */
export function EnergyByGeneratorCard({ data }: { data: DieselData }) {
  const { selectedDeviceIds } = useFilters()
  const isDay = isDayView(data.period)
  // Days have no generators-monthly-energy figure; the daily series has it.
  const query = isDay ? data.series : data.energy
  const source = isDay
    ? (data.series.data ?? []).map((g) => ({
        ...g,
        energyKwh: sumNumbers(g.points.map((p) => p.kwh)),
      }))
    : (data.energy.data ?? [])
  const gens = generatorPalette(
    selectGenerators(source, selectedDeviceIds, data.devices)
  )
  const rows = gens.map((g) => ({
    key: g.key,
    label: g.label,
    value: g.energyKwh,
    color: g.color,
  }))
  const total = sumNumbers(rows.map((r) => r.value))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy by generator</CardTitle>
        <CardDescription>{scopeText(data.period)}</CardDescription>
        <CardAction>
          <InfoHint>
            Energy each generator supplied over the selected period.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="mx-auto size-44 rounded-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyNote>No generators in the current selection.</EmptyNote>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Donut
              rows={rows}
              centerTop={formatNumber(total, 0)}
              centerBottom="kWh total"
              formatValue={kwh}
            />
            <Legend rows={rows} formatValue={kwh} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Old GeneratorStatus2.js: run hours and fuel used per generator. */
export function GeneratorStatusCard({ data }: { data: DieselData }) {
  const { selectedDeviceIds } = useFilters()
  const query = data.runtimeFuel
  const gens = generatorPalette(
    selectGenerators(query.data ?? [], selectedDeviceIds, data.devices)
  )
  const hourRows = gens.map((g) => ({
    key: g.key,
    label: g.label,
    value: g.runtimeHours,
    color: g.color,
  }))
  const fuelRows = gens.map((g) => ({
    key: g.key,
    label: g.label,
    value: g.fuelLitres,
    color: g.color,
  }))
  const totalHours = sumNumbers(hourRows.map((r) => r.value))
  const totalFuel = sumNumbers(fuelRows.map((r) => r.value))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generator status</CardTitle>
        <CardDescription>{scopeText(data.period, true)}</CardDescription>
        <CardAction>
          <InfoHint>
            How long each generator ran and how much diesel it used.{" "}
            {isDayView(data.period) && MONTH_ONLY_HINT}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="mx-auto size-40 rounded-full" />
            <Skeleton className="mx-auto size-40 rounded-full" />
          </div>
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : gens.length === 0 ? (
          <EmptyNote>No generators in the current selection.</EmptyNote>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-3">
              <Donut
                rows={hourRows}
                centerTop={formatHours(totalHours)}
                centerBottom="run hours"
                formatValue={formatHours}
                className="aspect-square h-40"
              />
              <Legend rows={hourRows} formatValue={formatHours} />
            </div>
            <div className="flex flex-col items-center gap-3">
              <Donut
                rows={fuelRows}
                centerTop={`${formatNumber(totalFuel, 0)} L`}
                centerBottom="fuel used"
                formatValue={litres}
                className="aspect-square h-40"
              />
              <Legend rows={fuelRows} formatValue={litres} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
