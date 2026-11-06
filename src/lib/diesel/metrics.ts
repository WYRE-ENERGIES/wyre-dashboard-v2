import { eachMonthOfInterval, format, isAfter, startOfMonth } from "date-fns"

import type {
  CostMetrics,
  FuelUsagePoint,
  GeneratorEnergy,
  GeneratorMetrics,
  GeneratorRef,
  GeneratorRuntimeFuel,
  GeneratorSeries,
  MonthYear,
} from "@/lib/api/diesel-types"
import type { DeviceBase } from "@/lib/api/types"
import {
  isDayView,
  isoDate,
  periodEnd,
  periodStart,
  type Period,
} from "@/lib/period"

/**
 * Diesel Overview business rules. The endpoints only take `?month=&year=`
 * (inventory 06 §2.11), so the global period is mapped onto months here:
 *
 * - Day   → the day's month; daily series are filtered to that day, and
 *           month-only aggregates are labelled as the whole month.
 * - Range → the one or two months it touches, the same way: daily series
 *           are filtered to the range, aggregates cover whole months.
 * - Month → that month.
 * - Year  → every month of the year up to now, fetched separately and
 *           aggregated client-side (endpoint-update proposal E2: accept a
 *           start/end range instead).
 */

/** The months a period needs, oldest first. Never includes a future month. */
export function monthsOfPeriod(period: Period, now = new Date()): MonthYear[] {
  const start = periodStart(period)
  if (period.kind === "range") {
    // A range touches one or two months.
    return eachMonthOfInterval({ start, end: periodEnd(period, now) }).map(
      (d) => ({ month: d.getMonth() + 1, year: d.getFullYear() })
    )
  }
  if (period.kind !== "year")
    return [{ month: start.getMonth() + 1, year: start.getFullYear() }]
  const out: MonthYear[] = []
  for (let m = 0; m < 12; m++) {
    const first = new Date(start.getFullYear(), m, 1)
    if (isAfter(first, startOfMonth(now))) break
    out.push({ month: m + 1, year: start.getFullYear() })
  }
  return out
}

/** Whether a card that can only show whole months should say so (a day or
 * a range of days shows the month(s) it falls in). */
export const isMonthScopedOnDay = (period: Period) => isDayView(period)

/** Keep only the points dated inside a day or range. */
const insidePeriod = <P extends { date: string }>(
  period: Period,
  points: P[]
) => {
  const start = isoDate(periodStart(period))
  const end = isoDate(periodEnd(period))
  return points.filter((p) => p.date >= start && p.date <= end)
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const nonZero = (values: number[]) => values.filter((v) => v !== 0)
const mean = (values: number[]) =>
  values.length ? sum(values) / values.length : 0

const keyOf = (g: GeneratorRef) =>
  g.deviceId !== undefined ? `id:${g.deviceId}` : `name:${g.name}`

/** Merge per-month generator rows by generator, summing the numeric fields. */
function mergeGenerators<T extends GeneratorRef>(
  months: T[][],
  fields: Array<keyof T>
): T[] {
  const map = new Map<string, T>()
  for (const rows of months) {
    for (const row of rows) {
      const key = keyOf(row)
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...row })
        continue
      }
      for (const field of fields) {
        ;(prev[field] as number) =
          (prev[field] as number) + (row[field] as number)
      }
    }
  }
  return [...map.values()]
}

export const mergeMonthlyEnergy = (months: GeneratorEnergy[][]) =>
  mergeGenerators(months, ["energyKwh"])

export const mergeRuntimeFuel = (months: GeneratorRuntimeFuel[][]) =>
  mergeGenerators(months, ["runtimeHours", "fuelLitres"])

/** Month: daily points as sent. Year: one point per month (summed). Day:
 * only that day's point. */
export function shapeGeneratorSeries(
  period: Period,
  months: GeneratorSeries[][],
  monthList: MonthYear[]
): GeneratorSeries[] {
  if (period.kind === "year") {
    const monthly = months.map((gens, i) =>
      gens.map((g) => ({
        ...g,
        points: [
          {
            date: monthDate(monthList[i]),
            kwh: sum(g.points.map((p) => p.kwh)),
            fuelLitres: sum(g.points.map((p) => p.fuelLitres)),
          },
        ],
      }))
    )
    return mergeSeries(monthly)
  }
  // The API returns a day past the end (and future days of the current
  // month); keep only days inside the period.
  return mergeSeries(months).map((g) => ({
    ...g,
    points: insidePeriod(period, g.points),
  }))
}

/** `yyyy-MM-01`: the date a monthly bucket is plotted at. */
const monthDate = ({ month, year }: MonthYear) =>
  `${year}-${String(month).padStart(2, "0")}-01`

function mergeSeries(months: GeneratorSeries[][]): GeneratorSeries[] {
  const map = new Map<string, GeneratorSeries>()
  for (const gens of months) {
    for (const g of gens) {
      const key = keyOf(g)
      const points = g.points.filter((p) => p.date)
      const prev = map.get(key)
      if (prev) prev.points.push(...points)
      else map.set(key, { ...g, points: [...points] })
    }
  }
  return [...map.values()]
}

export function shapeFuelUsage(
  period: Period,
  months: FuelUsagePoint[][],
  monthList: MonthYear[]
): FuelUsagePoint[] {
  if (period.kind === "year") {
    return months.map((points, i) => ({
      date: monthDate(monthList[i]),
      reportedLitres: sum(points.map((p) => p.reportedLitres)),
      emsLitres: sum(points.map((p) => p.emsLitres)),
    }))
  }
  return insidePeriod(period, months.flat())
}

/**
 * Year view of generator-metrics: there is no yearly endpoint, so months with
 * data are combined. Max demand = highest monthly max; min = lowest non-zero
 * monthly min; average, efficiency, specific consumption and score = mean of
 * the months that reported a value. An approximation until the endpoint takes
 * a range (proposal E2).
 */
export function mergeGeneratorMetrics(
  months: GeneratorMetrics[]
): GeneratorMetrics {
  if (months.length === 1) return months[0]
  const mins = nonZero(months.map((m) => m.demand.min))
  return {
    fuelEfficiency: mean(nonZero(months.map((m) => m.fuelEfficiency))),
    fuelConsumption: mean(nonZero(months.map((m) => m.fuelConsumption))),
    demand: {
      max: Math.max(0, ...months.map((m) => m.demand.max)),
      avg: mean(nonZero(months.map((m) => m.demand.avg))),
      min: mins.length ? Math.min(...mins) : 0,
    },
    efficiencyScore: mean(nonZero(months.map((m) => m.efficiencyScore))),
  }
}

/** Year view of cost-metrics: total cost is summed; cost per kWh is the mean
 * of months with a value; the annual forecast is the latest month's. */
export function mergeCostMetrics(months: CostMetrics[]): CostMetrics {
  if (months.length === 1) return months[0]
  const latest = [...months].reverse().find((m) => m.annualForecast !== 0)
  return {
    totalCost: sum(months.map((m) => m.totalCost)),
    costPerKwh: mean(nonZero(months.map((m) => m.costPerKwh))),
    annualForecast: latest?.annualForecast ?? 0,
  }
}

export const sumNumbers = sum

/**
 * Old OperationalEfficiencyCard.js:20 — specific fuel consumption is the
 * API's `fuel_consumption.value / 1000`, shown in L/kWh.
 */
export const specificFuelConsumption = (m: GeneratorMetrics) =>
  m.fuelConsumption / 1000

export type DemandIssue =
  "avg-below-min" | "avg-above-max" | "min-above-max" | null

/**
 * Production showed AVG 17.27 below MIN 21.66 kVA (live walkthrough). The
 * values come from the server, so they're displayed as given, but a broken
 * ordering is flagged instead of passing silently.
 */
export function demandIssue({
  max,
  avg,
  min,
}: GeneratorMetrics["demand"]): DemandIssue {
  if (max === 0 && avg === 0 && min === 0) return null
  if (min > max) return "min-above-max"
  if (avg < min) return "avg-below-min"
  if (avg > max) return "avg-above-max"
  return null
}

export const DEMAND_ISSUE_TEXT: Record<Exclude<DemandIssue, null>, string> = {
  "avg-below-min": "The average reported for this period is below the minimum.",
  "avg-above-max": "The average reported for this period is above the maximum.",
  "min-above-max": "The minimum reported for this period is above the maximum.",
}

/**
 * Global device filter: keep only selected generators. The API identifies
 * generators by name (sometimes with a device id); the sidebar by device id.
 * An empty selection means every device.
 */
export function selectGenerators<T extends GeneratorRef>(
  rows: T[],
  selectedDeviceIds: number[],
  devices: DeviceBase[] | undefined
): T[] {
  if (selectedDeviceIds.length === 0) return rows
  const selected = new Set(selectedDeviceIds)
  const names = new Set(
    (devices ?? [])
      .filter((d) => selected.has(d.device_id))
      .map((d) => normaliseName(d.name))
  )
  return rows.filter((row) =>
    row.deviceId !== undefined
      ? selected.has(row.deviceId)
      : names.has(normaliseName(row.name))
  )
}

const normaliseName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ")

/** Rows for the fuel-breakup chart: one row per date, `{key}_kwh` and
 * `{key}_fuel` per generator (old FuelUsageBreakupCard.js:45-72). */
export function pivotSeries(gens: Array<GeneratorSeries & { key: string }>) {
  const dates = [
    ...new Set(gens.flatMap((g) => g.points.map((p) => p.date))),
  ].sort()
  return dates.map((date) => {
    const row: Record<string, number | string> = { date }
    for (const g of gens) {
      const point = g.points.find((p) => p.date === date)
      row[`${g.key}_kwh`] = point?.kwh ?? 0
      row[`${g.key}_fuel`] = point?.fuelLitres ?? 0
    }
    return row
  })
}

/** Axis/tooltip label for a series date at the period's granularity. */
export function seriesDateLabel(period: Period, date: string, long = false) {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  if (period.kind === "year") return format(d, long ? "MMMM yyyy" : "MMM")
  return format(d, long ? "EEE d MMM yyyy" : "d MMM")
}
