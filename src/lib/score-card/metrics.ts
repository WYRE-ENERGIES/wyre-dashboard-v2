import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
} from "date-fns"

import type {
  FuelConsumption,
  GeneratorSizeEfficiency,
  ScoreCardDevice,
  ScoreCardResponse,
} from "@/lib/api/score-card-types"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Score Card business rules, ported from the old app:
 * - helpers/genericHelpers.js (calculateRatio, getPeakToAverageMessage,
 *   getGeneratorSizeMessage, getBaselineEnergyColor, calculatePercentage,
 *   sumPeakToAveragePowerRatios, sumScoreCardCarbonEmissions)
 * - components/cards/BaselineEnergy.js, ScorecardCarbonEmmission.js
 * - mainAppPages/ScoreCard.js (operating-time aggregation)
 *
 * Every function returns finite numbers (or null when there is nothing to
 * compute), so the UI never shows NaN, Infinity or "undefined".
 */

export type Tone = "good" | "fair" | "bad"

/** Numbers can arrive as strings ("1,234.5"); anything unparseable is 0. */
export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Devices from either `authenticatedData.devices` or `.branches[0].devices`
 * (the six endpoints are inconsistent, see score-card-types.ts), narrowed to
 * the global device filter (old helpers/v2/organizationDataHelpers.js
 * `devicesArray`: empty selection = all devices). */
export function scoreCardDevices(
  response: ScoreCardResponse | undefined,
  selectedDeviceIds: number[]
) {
  const data = response?.authenticatedData
  const devices = data?.devices ?? data?.branches?.[0]?.devices ?? []
  return selectedDeviceIds.length
    ? devices.filter((d) => selectedDeviceIds.includes(d.device_id))
    : devices
}

// ---------------------------------------------------------------------------
// Pace: how far through the period we are.

/**
 * The old "Savings Inbound" projected usage to the end of the *current*
 * month (`used / today's day-of-month × days in this month`) whatever range
 * was selected, and labelled it "So far (N Days)" with today's date. This
 * generalises the same month-pace projection to the selected period: elapsed
 * days (hours for a Day) over the period's full length. A finished period
 * has a factor of 1, so the projection is simply what was used.
 */
export function periodPace(period: Period, now = new Date()) {
  const start = periodStart(period)
  const end = periodEnd(period, now)
  const fullEnd =
    period.kind === "day"
      ? endOfDay(start)
      : period.kind === "month"
        ? endOfMonth(start)
        : endOfYear(start)
  const complete = end.getTime() >= fullEnd.getTime()

  if (period.kind === "day") {
    const elapsedHours = complete
      ? 24
      : Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3_600_000))
    return {
      complete,
      factor: 24 / elapsedHours,
      elapsedLabel: complete
        ? "Used (whole day)"
        : `So far (${elapsedHours} h)`,
    }
  }
  const totalDays = differenceInCalendarDays(fullEnd, start) + 1
  const elapsedDays = complete
    ? totalDays
    : Math.max(1, differenceInCalendarDays(end, start) + 1)
  const days = `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"}`
  return {
    complete,
    factor: totalDays / elapsedDays,
    elapsedLabel: complete ? `Used (${days})` : `So far (${days})`,
  }
}

/** `round(part / whole × 100)`, or null when whole is 0 (the old
 * calculatePercentage showed "Infinity%" there). */
export function percentUsed(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

// ---------------------------------------------------------------------------
// Baseline energy

/** Old BaselineEnergy.js: the `baseline_energy` of the source device (last
 * match wins). Savings Inbound = forecast − projected use. */
export function baselineEnergy(
  devices: ScoreCardDevice[],
  period: Period,
  now = new Date()
) {
  const sources = devices.filter(
    (d) => d.is_source && d.score_card?.baseline_energy
  )
  const baseline = sources.at(-1)?.score_card?.baseline_energy
  if (!baseline) return null
  const forecast = num(baseline.forecast)
  const used = num(baseline.used)
  const pace = periodPace(period, now)
  const savings = forecast - used * pace.factor
  return {
    forecast,
    used,
    unit: baseline.unit || "kWh",
    percentUsed: percentUsed(used, forecast),
    savings,
    savingsTone: (savings > 0 ? "good" : "bad") as Tone,
    pace,
  }
}

// ---------------------------------------------------------------------------
// Peak to average power ratio

/** calculateRatio: avg / peak to 2 dp; 0 when not computable. */
export function calculateRatio(avg: number, peak: number) {
  const ratio = avg / peak
  return ratio && Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : 0
}

/** getPeakToAverageMessage: > 0.7 efficient, ≥ 0.5 fairly efficient. */
export function peakToAverageRating(ratio: number): {
  message: string
  tone: Tone
} {
  if (ratio > 0.7) return { message: "Efficient", tone: "good" }
  if (ratio >= 0.5) return { message: "Fairly efficient", tone: "fair" }
  return { message: "Inefficient - Higher is better", tone: "bad" }
}

/** sumPeakToAveragePowerRatios: peak = max of device peaks, avg = mean of
 * device averages; ratio = avg / peak. */
export function peakToAverage(devices: ScoreCardDevice[]) {
  const items = devices
    .map((d) => d.score_card?.peak_to_avg_power_ratio)
    .filter((p) => p != null)
  if (!items.length) return null
  const peak = Math.max(...items.map((p) => num(p.peak)))
  const avg = items.reduce((sum, p) => sum + num(p.avg), 0) / items.length
  const ratio = calculateRatio(avg, peak)
  return { peak, avg, unit: "kVA", ratio, ...peakToAverageRating(ratio) }
}

// ---------------------------------------------------------------------------
// Carbon emission

/** Old card text: "Equivalent to N Acacia trees", N = savings × 6. */
export const TREES_PER_TON = 6

/** sumScoreCardCarbonEmissions + ScorecardCarbonEmmission.js. The old card
 * formatted the savings into a string before multiplying by 6, so 0 or
 * values ≥ 1,000 gave "NaN trees"; here everything stays numeric. */
export function carbonEmission(
  devices: ScoreCardDevice[],
  period: Period,
  now = new Date()
) {
  const items = devices
    .map((d) => d.score_card?.score_card_carbon_emissions)
    .filter((c) => c != null)
  if (!items.length) return null
  const estimated = items.reduce((sum, c) => sum + num(c.estimated_value), 0)
  const actual = items.reduce((sum, c) => sum + num(c.actual_value), 0)
  const pace = periodPace(period, now)
  const savings = estimated - actual * pace.factor
  return {
    estimated,
    actual,
    unit: "tons",
    percentUsed: percentUsed(actual, estimated),
    savings,
    savingsTone: (savings > 0 ? "good" : "bad") as Tone,
    /** Only positive savings translate into trees; null otherwise. */
    trees: savings > 0 ? savings * TREES_PER_TON : null,
    pace,
  }
}

// ---------------------------------------------------------------------------
// Generator size efficiency

/** getGeneratorSizeMessage, thresholds 0.01 / 0.7 / 0.51 / 0.36 of the
 * generator's size. */
export function generatorSizeRating(usagePercent: number): {
  message: string
  tone: Tone
} {
  const ratio = usagePercent / 100
  if (ratio === 0.01) return { message: "Not In Use", tone: "bad" }
  if (ratio > 0.7) return { message: "Overloaded", tone: "bad" }
  if (ratio >= 0.51) return { message: "Efficient Loading", tone: "good" }
  if (ratio >= 0.36)
    return { message: "Fairly Efficient Loading", tone: "good" }
  return { message: "Inefficient", tone: "fair" }
}

/** One entry per generator (`is_gen === true`). */
export function generatorSizeEfficiency(devices: ScoreCardDevice[]) {
  return devices
    .map((d) => d.score_card?.generator_size_efficiency)
    .filter((g): g is GeneratorSizeEfficiency => g?.is_gen === true)
    .map((g) => {
      const usage = num(g.usage)
      return {
        name: g.name ?? "",
        size: g.size ?? "",
        usage,
        unit: g.unit || "%",
        ...generatorSizeRating(usage),
      }
    })
}

// ---------------------------------------------------------------------------
// Fuel efficiency

/** ScoreCardFuelConsumptionDoughnut.js: current kWh/L against the benchmark
 * of a well-maintained, well-sized generator. */
export function fuelEfficiency(devices: ScoreCardDevice[]) {
  return devices
    .map((d) => d.score_card?.fuel_consumption)
    .filter((f): f is FuelConsumption => f?.is_gen === true)
    .map((f) => {
      const current = num(f.fuel_efficiency?.current_score)
      const baseline = num(f.fuel_efficiency?.baseline)
      return {
        name: f.name ?? "",
        size: f.size ?? "",
        dieselLitres: num(f.diesel_usage),
        hours: num(f.time_used),
        current,
        baseline,
        /** Share of the benchmark reached, 0–100 (null without a benchmark). */
        percentOfBenchmark:
          baseline > 0 ? Math.min(100, (current / baseline) * 100) : null,
      }
    })
}

// ---------------------------------------------------------------------------
// Operating time deviation

/** Dates in operating-time charts: the format is not documented, so accept
 * ISO, `dd-MM-yyyy` and `dd/MM/yyyy` (with optional time). */
export function parseLooseDate(value: string): Date | null {
  const iso = parseISO(value)
  if (isValid(iso)) return iso
  for (const pattern of [
    "dd-MM-yyyy HH:mm",
    "dd-MM-yyyy",
    "dd/MM/yyyy HH:mm",
    "dd/MM/yyyy",
    "yyyy-MM-dd HH:mm",
  ]) {
    const d = parse(value, pattern, new Date())
    if (isValid(d)) return d
  }
  return null
}

export type OperatingTimePoint = {
  key: string
  label: string
  tooltipLabel: string
  hours: number
  energyKwh: number
}

/**
 * ScoreCard.js:122-225: over generator devices (`score_card.is_generator`),
 * sum the chart values and wasted energy index by index, and the totals.
 * The old code also "summed" the date labels index by index (string
 * concatenation); labels here come from the first generator. For a Year the
 * daily points are summed into months (granularity rule: Year → monthly).
 */
export function operatingTime(devices: ScoreCardDevice[], period: Period) {
  const generators = devices.filter(
    (d) => d.score_card?.is_generator && d.score_card.operating_time
  )
  if (!generators.length) return null
  const times = generators.map((d) => d.score_card!.operating_time!)
  const dates = times.find((t) => t.chart?.dates?.length)?.chart?.dates ?? []
  const length = Math.max(
    dates.length,
    ...times.map((t) => t.chart?.values?.length ?? 0)
  )

  // Hourly only when the backend sends times (it may send one daily point for a Day).
  const hourly = dates.some((d) => /\d:\d/.test(d))
  const daily: OperatingTimePoint[] = Array.from({ length }, (_, i) => {
    const raw = dates[i] ?? String(i + 1)
    const date = parseLooseDate(raw)
    return {
      key: date ? format(date, "yyyy-MM-dd'T'HH:mm") : raw,
      label: date ? format(date, hourly ? "HH:mm" : "d MMM") : raw,
      tooltipLabel: date
        ? format(date, hourly ? "d MMM yyyy, HH:mm" : "EEE d MMM yyyy")
        : raw,
      hours: times.reduce((sum, t) => sum + num(t.chart?.values?.[i]), 0),
      energyKwh: times.reduce(
        (sum, t) => sum + num(t.chart?.energy_wasted?.[i]),
        0
      ),
    }
  })

  let points = daily
  let resolution: "hourly" | "daily" | "monthly" = hourly ? "hourly" : "daily"
  if (period.kind === "year") {
    const months = new Map<string, OperatingTimePoint>()
    for (const p of daily) {
      const date = parseLooseDate(p.key)
      if (!date) continue
      const month = startOfMonth(date)
      const key = format(month, "yyyy-MM")
      const entry = months.get(key) ?? {
        key,
        label: format(month, "MMM"),
        tooltipLabel: format(month, "MMMM yyyy"),
        hours: 0,
        energyKwh: 0,
      }
      entry.hours += p.hours
      entry.energyKwh += p.energyKwh
      months.set(key, entry)
    }
    if (months.size) {
      points = [...months.values()]
      resolution = "monthly"
    }
  }

  const total = (pick: (t: (typeof times)[number]) => unknown) =>
    times.reduce((sum, t) => sum + num(pick(t)), 0)
  return {
    points,
    resolution,
    totalHours: total((t) => t.estimated_time_wasted?.value),
    totalEnergyKwh: total(
      (t) =>
        t.estimated_energy_wasted?.value ?? t.estimated_energy_wasted?.total
    ),
    totalDieselLitres: total((t) => t.estimated_diesel_wasted?.value),
    totalCostNaira: total((t) => t.estimated_cost?.value),
  }
}
