import { eachDayOfInterval, format, isValid, parseISO } from "date-fns"

import type {
  DemandRow,
  FlowDirection,
  SolarDate,
  SolarYield,
} from "@/lib/api/solar-types"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Solar Overview business rules, from production (origin/dev
 * SolarOverviewPage.js; inventory 07 §2) unless noted.
 */

// --- Live polling (07 §2.2) -------------------------------------------------

/** Default poll interval when `solar/live` sends no `refresh_interval_seconds`. */
export const LIVE_POLL_DEFAULT_SECONDS = 5 * 60
/** Polling pauses after this long without user activity. */
export const LIVE_IDLE_MS = 15 * 60 * 1000

export const livePollMs = (refreshSeconds: number | null | undefined) =>
  (refreshSeconds && refreshSeconds > 0
    ? refreshSeconds
    : LIVE_POLL_DEFAULT_SECONDS) * 1000

// --- Flow diagram (07 §2.5; old FlowDiagram :809-1000) ----------------------

export type BatteryStatus = "Charging" | "Discharging" | "Idle"

/** `direction` wins (OUT = discharging, IN = charging); otherwise the sign of
 * kW (> 0 discharging, < 0 charging); otherwise idle. */
export function batteryStatus(
  direction: FlowDirection,
  kw: number
): BatteryStatus {
  if (direction === "OUT") return "Discharging"
  if (direction === "IN") return "Charging"
  if (kw > 0) return "Discharging"
  if (kw < 0) return "Charging"
  return "Idle"
}

export type FlowAnimation = "to-centre" | "from-centre" | "none"

/**
 * How a connector between a node and the central Production node animates:
 * OUT = node → Production, IN = Production → node, IDLE (or unknown) = no
 * animation. Grid and generator connectors never animate while their status
 * is OFF.
 */
export function connectorFlow(
  direction: FlowDirection,
  sourceOff = false
): FlowAnimation {
  if (sourceOff) return "none"
  if (direction === "OUT") return "to-centre"
  if (direction === "IN") return "from-centre"
  return "none"
}

/** Generator node only shows when its status is ON; it is "Supplying" when
 * its kW is above 0, else "Idle". */
export const generatorFlowStatus = (kw: number) =>
  kw > 0 ? "Supplying" : "Idle"

// --- Period mapping --------------------------------------------------------

/** The `solar/yield` filter for a Day or Month period. A Year has no yield
 * filter: it is built from its months (proposal: accept start/end). */
export function periodSolarDate(period: Period): SolarDate {
  const start = periodStart(period)
  const base = { year: start.getFullYear(), month: start.getMonth() + 1 }
  return period.kind === "day" ? { ...base, day: start.getDate() } : base
}

/** The buckets a Month (each elapsed day) or Year (each elapsed month)
 * splits into for the daily / monthly charts. */
export function periodBuckets(
  period: Period,
  now = new Date()
): Array<SolarDate & { key: string }> {
  const start = periodStart(period)
  if (start > now) return []
  const end = periodEnd(period, now)
  if (period.kind === "year") {
    return Array.from({ length: end.getMonth() + 1 }, (_, m) => ({
      year: start.getFullYear(),
      month: m + 1,
      key: format(new Date(start.getFullYear(), m, 1), "yyyy-MM"),
    }))
  }
  return eachDayOfInterval({ start, end }).map((d) => ({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    key: format(d, "yyyy-MM-dd"),
  }))
}

/** Run `fn` over `items` with at most `limit` in flight (the per-day yield
 * fan-out would otherwise send ~31 requests at once). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return out
}

export type SolarSeriesRow = {
  key: string
  productionKwh: number
  gridKwh: number
  loadKwh: number
  chargeKwh: number
  dischargeKwh: number
}

/** One chart row per bucket, from each bucket's yield `total`. */
export const seriesRow = (key: string, y: SolarYield): SolarSeriesRow => ({
  key,
  productionKwh: y.generation.total.kwh,
  gridKwh: y.grid.total.kwh,
  loadKwh: y.load.total.kwh,
  chargeKwh: y.battery.total.chargeKwh,
  dischargeKwh: y.battery.total.dischargeKwh,
})

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/**
 * A Year's yield from its months: energy, cost and battery totals are
 * summed; demand max/min are the extremes (with their timestamps) and the
 * average is the mean of months that reported one.
 */
export function mergeYields(months: SolarYield[]): SolarYield {
  const total = <K extends "generation" | "load" | "grid">(k: K) => ({
    kwh: sum(months.map((m) => m[k].total.kwh)),
    cost: sum(months.map((m) => m[k].total.cost)),
  })
  const demands = months.map((m) => m.demand.total)
  const withMax = demands.filter((d) => d.maxKw > 0)
  const withMin = demands.filter((d) => d.minKw > 0)
  const max = withMax.reduce<DemandRow | null>(
    (a, d) => (!a || d.maxKw > a.maxKw ? d : a),
    null
  )
  const min = withMin.reduce<DemandRow | null>(
    (a, d) => (!a || d.minKw < a.minKw ? d : a),
    null
  )
  const avgs = demands.map((d) => d.avgKw).filter((v) => v > 0)
  const zero = { kwh: 0, cost: 0 }
  const generation = total("generation")
  const load = total("load")
  const grid = total("grid")
  const battery = {
    chargeKwh: sum(months.map((m) => m.battery.total.chargeKwh)),
    dischargeKwh: sum(months.map((m) => m.battery.total.dischargeKwh)),
  }
  const demand: DemandRow = {
    maxKw: max?.maxKw ?? 0,
    maxAt: max?.maxAt ?? null,
    minKw: min?.minKw ?? 0,
    minAt: min?.minAt ?? null,
    avgKw: avgs.length ? sum(avgs) / avgs.length : 0,
  }
  const noBattery = { chargeKwh: 0, dischargeKwh: 0 }
  const noDemand: DemandRow = {
    maxKw: 0,
    maxAt: null,
    minKw: 0,
    minAt: null,
    avgKw: 0,
  }
  return {
    filtered: true,
    windowLabel: null,
    batterySince: null,
    generation: { total: generation, today: zero, monthly: zero },
    load: { total: load, today: zero, monthly: zero },
    grid: { total: grid, today: zero, monthly: zero },
    battery: { total: battery, today: noBattery, monthly: noBattery },
    demand: { total: demand, today: noDemand, monthly: noDemand },
  }
}

/** `max_at` / `min_at` as `HH:mm` for a day, else `d MMM, HH:mm`
 * (old formatDemandAt, :181-191). Bare times pass through. */
export function formatDemandAt(
  value: string | null,
  timeOnly: boolean
): string | null {
  if (!value) return null
  const time = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (time) return `${time[1].padStart(2, "0")}:${time[2]}`
  const parsed = parseISO(value)
  const date = isValid(parsed) ? parsed : new Date(value)
  if (!isValid(date)) return null
  return format(date, timeOnly ? "HH:mm" : "d MMM, HH:mm")
}

/** Chart x-axis label for a bucket key (`yyyy-MM-dd` or `yyyy-MM`). */
export function bucketLabel(key: string, long = false) {
  if (key.length === 7) {
    const d = parseISO(`${key}-01`)
    return isValid(d) ? format(d, long ? "MMMM yyyy" : "MMM") : key
  }
  const d = parseISO(key)
  return isValid(d) ? format(d, long ? "EEE d MMM yyyy" : "d MMM") : key
}
