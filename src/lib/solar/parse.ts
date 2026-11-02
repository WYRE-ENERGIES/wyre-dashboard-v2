import { format, isValid, parseISO } from "date-fns"

import type {
  BatteryRow,
  DemandRow,
  EnergyRow,
  FlowDirection,
  RawBatteryPlot,
  RawSolarLive,
  RawSolarYield,
  SolarBatteryPlot,
  SolarLive,
  SolarYield,
  YieldBucketKey,
} from "@/lib/api/solar-types"

/**
 * Normalisers for the solar endpoints, ported from production's readers
 * (origin/dev SolarOverviewPage.js) with their crash guards (cc39c97).
 */

export const BUCKETS: YieldBucketKey[] = ["total", "today", "monthly"]

export const num = (value: unknown) => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN
  return Number.isFinite(n) ? n : 0
}

const optionalNum = (value: unknown) =>
  value == null || value === "" ? null : num(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null

/** `response.data.data ?? response.data` (solar.action.js:29). */
export function unwrapSolar<T>(body: unknown): T | undefined {
  if (isRecord(body) && "data" in body && body.data != null)
    return body.data as T
  return body as T | undefined
}

function direction(value: unknown): FlowDirection {
  const d = String(value ?? "")
    .trim()
    .toUpperCase()
  return d === "IN" || d === "OUT" || d === "IDLE" ? d : null
}

const isOn = (status: unknown) =>
  String(status ?? "")
    .trim()
    .toUpperCase() === "ON"

export const DEFAULT_OVERLAY_MESSAGE =
  "We are experiencing a service disruption. We will be back shortly."

export function parseLive(raw: RawSolarLive | undefined): SolarLive {
  const pv = raw?.pv ?? {}
  // A battery payload that isn't a plain object means "no battery" (cc39c97).
  const battery = isRecord(raw?.battery) ? raw.battery : null
  const capacity = battery
    ? Number(battery.installed_battery_capacity_kwh)
    : NaN
  const refresh = Number(raw?.refresh_interval_seconds)
  return {
    pv: {
      kw: num(pv.kw),
      capacityKwp: num(pv.installed_capacity_kwp),
      percent: num(pv.percentage),
      direction: direction(pv.direction),
    },
    battery: battery
      ? {
          kw: num(battery.kw),
          percent: num(battery.percentage),
          direction: direction(battery.direction),
          capacityKwh:
            Number.isFinite(capacity) &&
            battery.installed_battery_capacity_kwh != null
              ? capacity
              : null,
        }
      : null,
    grid: {
      kw: num(raw?.grid?.kw),
      direction: direction(raw?.grid?.direction),
      on: isOn(raw?.grid?.status),
    },
    load: {
      kw: num(raw?.load?.kw),
      direction: direction(raw?.load?.direction),
    },
    generator: {
      kw: num(raw?.generator_power?.kw),
      direction: direction(raw?.generator_power?.direction),
      on: isOn(raw?.generator_power?.status),
    },
    overlay: {
      active: raw?.overlay?.is_overlay === true,
      message: text(raw?.overlay?.message) ?? DEFAULT_OVERLAY_MESSAGE,
    },
    refreshSeconds: Number.isFinite(refresh) && refresh > 0 ? refresh : null,
  }
}

const energyRow = (raw: unknown): EnergyRow => {
  const r = isRecord(raw) ? raw : {}
  return { kwh: num(r.kwh), cost: num(r.cost) }
}
const batteryRow = (raw: unknown): BatteryRow => {
  const r = isRecord(raw) ? raw : {}
  return { chargeKwh: num(r.charge_kwh), dischargeKwh: num(r.discharge_kwh) }
}
const demandRow = (raw: unknown): DemandRow => {
  const r = isRecord(raw) ? raw : {}
  return {
    maxKw: num(r.max_kw),
    maxAt: text(r.max_at),
    minKw: num(r.min_kw),
    minAt: text(r.min_at),
    avgKw: num(r.avg_kw),
  }
}

function buckets<T>(
  raw: unknown,
  row: (raw: unknown) => T
): Record<YieldBucketKey, T> {
  const r = isRecord(raw) ? raw : {}
  return { total: row(r.total), today: row(r.today), monthly: row(r.monthly) }
}

/** Production looks for the battery "since" date under ~30 keys
 * (SolarOverviewPage.js:327-408); these are the same candidates, in order. */
const SINCE_KEYS = {
  battery: [
    "since",
    "since_date",
    "total_since",
    "total_since_date",
    "tracking_start_date",
    "total_start_date",
    "start_date",
    "total_date_range",
    "date_range",
  ],
  batteryTotal: [
    "since",
    "since_date",
    "start_date",
    "from_date",
    "date_range",
    "period",
    "date_label",
  ],
  root: [
    "since",
    "since_date",
    "total_since",
    "total_since_date",
    "tracking_start_date",
    "battery_since",
    "battery_since_date",
  ],
  generationTotal: ["since_date", "start_date", "date_range"],
}

/** "Since 01 Jan 2025" from a date, a range ("01 Jan 2025 – …") or an
 * already-formatted "since …" string. */
export function sinceLabel(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  if (/^since\s/i.test(raw)) return raw.charAt(0).toUpperCase() + raw.slice(1)
  const start = raw.split(/\s*[‐-―−–—-]\s+/)[0]?.trim() || raw
  for (const candidate of [start, raw]) {
    const iso = parseISO(candidate)
    const parsed = isValid(iso) ? iso : new Date(candidate)
    if (isValid(parsed)) return `Since ${format(parsed, "dd MMM yyyy")}`
  }
  return null
}

function batterySince(raw: RawSolarYield): string | null {
  const battery = isRecord(raw.battery) ? raw.battery : {}
  const batteryTotal = isRecord(battery.total) ? battery.total : {}
  const generationTotal = isRecord(raw.generation?.total)
    ? (raw.generation.total as Record<string, unknown>)
    : {}
  const sources: Array<[Record<string, unknown>, string[]]> = [
    [battery, SINCE_KEYS.battery],
    [batteryTotal, SINCE_KEYS.batteryTotal],
    [raw, SINCE_KEYS.root],
    [generationTotal, SINCE_KEYS.generationTotal],
  ]
  for (const [source, keys] of sources) {
    for (const key of keys) {
      const label = sinceLabel(source[key])
      if (label) return label
    }
  }
  return null
}

export function parseYield(raw: RawSolarYield | undefined): SolarYield {
  const r = raw ?? {}
  const year = Number(r.filter?.year)
  const month = Number(r.filter?.month)
  return {
    filtered:
      Number.isInteger(year) &&
      year > 0 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12,
    windowLabel: text(
      isRecord(r.generation?.total) ? r.generation?.total?.period_label : null
    ),
    batterySince: batterySince(r),
    generation: buckets(r.generation, energyRow),
    load: buckets(r.load, energyRow),
    grid: buckets(r.grid, energyRow),
    battery: buckets(isRecord(r.battery) ? r.battery : {}, batteryRow),
    demand: buckets(r.power_demand, demandRow),
  }
}

/** First present key among the case/unit variants (SolarOverviewPage.js:201-238). */
function firstOf(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (record[key] != null) return num(record[key])
  return null
}

const CHARGE_KEYS = [
  "battery_charge_kW",
  "battery_charge_kw",
  "battery_charge_kwh",
]
const DISCHARGE_KEYS = [
  "battery_discharge_kW",
  "battery_discharge_kw",
  "battery_discharge_kwh",
]

export function parseBatteryPlot(
  raw: RawBatteryPlot | undefined
): SolarBatteryPlot {
  if (!isRecord(raw))
    return { points: [], totalCharge: null, totalDischarge: null }
  const hours = Array.isArray(raw.hours) ? raw.hours.filter(isRecord) : []
  return {
    points: hours.map((h) => ({
      label: text(h.hour_label) ?? "",
      chargeKw: firstOf(h, CHARGE_KEYS) ?? 0,
      dischargeKw: firstOf(h, DISCHARGE_KEYS) ?? 0,
      socPct: optionalNum(h.soc_pct),
    })),
    totalCharge: firstOf(
      raw,
      CHARGE_KEYS.map((k) => `total_${k}`)
    ),
    totalDischarge: firstOf(
      raw,
      DISCHARGE_KEYS.map((k) => `total_${k}`)
    ),
  }
}

export { optionalNum, text }
