import {
  addHours,
  addMonths,
  eachDayOfInterval,
  format,
  isAfter,
  isValid,
  parseISO,
  startOfHour,
} from "date-fns"

import type {
  BranchEnvelope,
  ParamDeviceBase,
} from "@/lib/api/parameters-types"
import {
  GRANULARITY,
  periodEnd,
  periodStart,
  type Granularity,
  type Period,
} from "@/lib/period"

/**
 * Time buckets shared by the Parameters pages. The old pages plotted the raw
 * date array of one device (UTILITY, or the first device) and zipped the other
 * devices' values onto it by index, which misaligned series whose dates
 * differed (03 §5). Here every series is placed by timestamp into the period's
 * buckets (Day → hours, Month → days, Year → months), so devices always line
 * up, and finer data than asked for is folded into the right bucket.
 */

export type Bucket = {
  key: string
  /** Bucket start, for sorting. */
  ts: number
  /** Short axis label: "14:00", "7", "Jul". */
  label: string
  /** Tooltip label: "Tue 14 Jul, 14:00", "Tue 14 Jul 2026", "July 2026". */
  tooltipLabel: string
  /** Table "Date/Time" cell: "14 Jul 2026, 14:00", "Tue 14 Jul 2026", "July 2026". */
  rowLabel: string
}

const KEY_FORMAT: Record<Granularity, string> = {
  hourly: "yyyy-MM-dd'T'HH",
  daily: "yyyy-MM-dd",
  monthly: "yyyy-MM",
}

export const bucketKey = (date: Date, granularity: Granularity) =>
  format(date, KEY_FORMAT[granularity])

function toBucket(date: Date, granularity: Granularity): Bucket {
  const key = bucketKey(date, granularity)
  if (granularity === "hourly") {
    return {
      key,
      ts: date.getTime(),
      label: format(date, "HH:00"),
      tooltipLabel: format(date, "EEE d MMM, HH:00"),
      rowLabel: format(date, "d MMM yyyy, HH:00"),
    }
  }
  if (granularity === "daily") {
    return {
      key,
      ts: date.getTime(),
      label: format(date, "d"),
      tooltipLabel: format(date, "EEE d MMM yyyy"),
      rowLabel: format(date, "EEE d MMM yyyy"),
    }
  }
  return {
    key,
    ts: date.getTime(),
    label: format(date, "MMM"),
    tooltipLabel: format(date, "MMMM yyyy"),
    rowLabel: format(date, "MMMM yyyy"),
  }
}

/** Every bucket of the period up to its end ("now" for the current period). */
export function periodBuckets(period: Period): Bucket[] {
  const granularity = GRANULARITY[period.kind]
  const start = periodStart(period)
  const end = periodEnd(period)
  const dates: Date[] = []
  if (granularity === "hourly") {
    for (let d = start; !isAfter(d, end); d = addHours(d, 1)) dates.push(d)
  } else if (granularity === "daily") {
    dates.push(...eachDayOfInterval({ start, end }))
  } else {
    for (let d = start; !isAfter(d, end); d = addMonths(d, 1)) dates.push(d)
  }
  return dates.map((d) => toBucket(d, granularity))
}

/** API dates are ISO strings without a zone (e.g. "2021-05-01T00:00:00"),
 * read as local time, like the old app's dayjs(). */
export function parseApiDate(value: string | null | undefined) {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

export type Aggregate = "sum" | "mean" | "min" | "max"

/**
 * Folds a `dates[]` / `values[]` pair into period buckets. Nulls are skipped;
 * a bucket with no value is absent from the result (not 0), so tables can
 * tell "no data" from "zero".
 */
export function bucketize(
  dates: string[] | undefined,
  values: Array<number | null | undefined> | undefined,
  granularity: Granularity,
  mode: Aggregate
) {
  const acc = new Map<
    string,
    { total: number; count: number; min: number; max: number }
  >()
  ;(dates ?? []).forEach((raw, i) => {
    const value = values?.[i]
    const date = parseApiDate(raw)
    if (!date || typeof value !== "number" || !Number.isFinite(value)) return
    const key = bucketKey(
      granularity === "hourly" ? startOfHour(date) : date,
      granularity
    )
    const entry = acc.get(key)
    if (entry) {
      entry.total += value
      entry.count += 1
      entry.min = Math.min(entry.min, value)
      entry.max = Math.max(entry.max, value)
    } else {
      acc.set(key, { total: value, count: 1, min: value, max: value })
    }
  })
  const result = new Map<string, number>()
  for (const [key, { total, count, min, max }] of acc) {
    result.set(
      key,
      mode === "sum"
        ? total
        : mode === "mean"
          ? total / count
          : mode === "min"
            ? min
            : max
    )
  }
  return result
}

/** Devices of a branch-scoped parameter response (`authenticatedData.devices`,
 * or `authenticatedData.branches[0].devices`). */
export function branchDevices<T>(response: BranchEnvelope<T> | undefined): T[] {
  const data = response?.authenticatedData
  return data?.devices ?? data?.branches?.[0]?.devices ?? []
}

/** The global device filter (old `devicesArray`): none selected = all devices. */
export function filterParamDevices<T extends ParamDeviceBase>(
  devices: T[],
  selected: number[]
) {
  return selected.length
    ? devices.filter(
        (d) => d.device_id !== undefined && selected.includes(d.device_id)
      )
    : devices
}

/** Stable chart/table key for a device. Keyed by id, not name, so two devices
 * with the same name no longer collapse into one column (03 §5). */
export const deviceKey = (device: ParamDeviceBase, index: number) =>
  `d${device.device_id ?? device.id ?? `i${index}`}`

const UNITS: Record<string, string> = {
  volts: "V",
  volt: "V",
  v: "V",
  amps: "A",
  amp: "A",
  a: "A",
  hz: "Hz",
  kw: "kW",
  kva: "kVA",
  kvar: "kVAr",
  kwh: "kWh",
  kvah: "kVAh",
  kvarh: "kVArh",
  pf: "",
  "%": "%",
}

/** Backend units ("volts", "amps", "hz", "kVAR", "pf") as display units. */
export function displayUnit(unit: string | null | undefined, fallback = "") {
  if (!unit) return fallback
  const known = UNITS[unit.trim().toLowerCase()]
  return known ?? unit.trim()
}

/** "Energy (kWh)" or just "Power factor" when there is no unit. */
export const withUnit = (label: string, unit: string) =>
  unit ? `${label} (${unit})` : label
