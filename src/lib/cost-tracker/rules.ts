import {
  differenceInMinutes,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isValid,
  isWithinInterval,
  parse,
  parseISO,
  startOfMonth,
} from "date-fns"

import type {
  BaselinePoint,
  DieselOverviewRow,
  DieselPurchase,
  Generator,
  GeneratorsResponse,
  Num,
  Payment,
  UtilityOverviewRow,
} from "@/lib/api/cost-tracker-types"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/** Backend numbers may be numbers or numeric strings; anything else is 0. */
export function num(value: Num) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN
  return Number.isFinite(n) ? n : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Tariff = amount ÷ value (kWh), 2 dp, 0 when not finite. Pre-paid, post-paid
 * and IPP, on add and edit (old AddBills.js:122-141, UpdateUtilityPayment.js:126-137).
 */
export function tariffOf(amount: number, value: number) {
  const t = amount / value
  return Number.isFinite(t) ? round2(t) : 0
}

/** Diesel purchase amount = price per litre × quantity (old DieselPurchasedTable.js:26-33). */
export const dieselAmount = (
  row: Pick<DieselPurchase, "price_per_litre" | "quantity">
) => num(row.price_per_litre) * num(row.quantity)

/** The register spells it `tarrif`; edit prefill read `tariff`. */
export const paymentTariff = (row: Payment) => num(row.tarrif ?? row.tariff)

/**
 * Diesel consumption entries can be edited only within 30 minutes of their
 * `record_time` (old AddDieselEntry.js:79-88 `canEditRecord`).
 */
export const EDIT_WINDOW_MINUTES = 30
export function canEditRecord(
  recordTime: string | null | undefined,
  now = new Date()
) {
  if (!recordTime) return false
  const recorded = parseDate(recordTime)
  if (!recorded) return false
  return differenceInMinutes(now, recorded) <= EDIT_WINDOW_MINUTES
}

/** Minutes left in the edit window (for the "Edit · 12 min left" hint). */
export function editMinutesLeft(
  recordTime: string | null | undefined,
  now = new Date()
) {
  const recorded = recordTime ? parseDate(recordTime) : null
  if (!recorded) return 0
  return Math.max(0, EDIT_WINDOW_MINUTES - differenceInMinutes(now, recorded))
}

/** ISO dates and datetimes ("2026-07-14", "2026-07-14T09:30:00Z"). */
export function parseDate(value: string | null | undefined) {
  if (!value) return null
  const d = parseISO(value)
  if (isValid(d)) return d
  const fallback = new Date(value)
  return isValid(fallback) ? fallback : null
}

const MONTH_FORMATS = [
  "MMMM yyyy",
  "MMM yyyy",
  "MMM-yyyy",
  "MMMM-yyyy",
  "yyyy-MM",
  "MM-yyyy",
  "MM/yyyy",
  "yyyy/MM",
]

/**
 * The overview endpoints label rows by month; the exact format is unverified
 * ("July 2026", "Jul-2026", "2026-07"…), so try the likely ones.
 */
export function parseMonthLabel(label: string | null | undefined) {
  if (!label) return null
  const text = label.trim()
  for (const fmt of MONTH_FORMATS) {
    const d = parse(text, fmt, new Date(2000, 0, 1))
    if (isValid(d)) return startOfMonth(d)
  }
  const d = parseDate(text)
  return d ? startOfMonth(d) : null
}

/** "July" / "7" / 7 plus a year → first day of that month. */
export function monthFromParts(month: string | number, year: string | number) {
  const y = Number(year)
  if (!Number.isFinite(y)) return null
  const m = Number(month)
  if (Number.isFinite(m) && m >= 1 && m <= 12) return new Date(y, m - 1, 1)
  return parseMonthLabel(`${month} ${y}`)
}

export const monthLabel = (d: Date) => format(d, "MMM yyyy")

/**
 * Cost data is monthly, so the overview shows the months inside the global
 * period: Year → its months (up to now), Month or Day → that month. Replaces
 * the old rolling 12 months (inventory §8 "Cost Tracker").
 */
export function monthsInPeriod(period: Period) {
  if (period.kind !== "year") return [startOfMonth(period.anchor)]
  return eachMonthOfInterval({
    start: periodStart(period),
    end: periodEnd(period),
  })
}

/** First to last day of the months in the period (Day widens to its month). */
export function periodMonthRange(period: Period) {
  const months = monthsInPeriod(period)
  return { start: months[0], end: endOfMonth(months[months.length - 1]) }
}

const monthKey = (d: Date) => format(d, "yyyy-MM")

/** Keeps overview rows whose month is inside the period, oldest first. */
export function overviewRowsInPeriod<T extends { month: string }>(
  rows: T[] | undefined,
  period: Period
) {
  const wanted = new Set(monthsInPeriod(period).map(monthKey))
  return (rows ?? [])
    .map((row) => ({ row, date: parseMonthLabel(row.month) }))
    .filter(
      (x): x is { row: T; date: Date } =>
        x.date !== null && wanted.has(monthKey(x.date))
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ row, date }) => ({ ...row, monthDate: date }))
}

/** Register rows dated inside the period's months, newest first. */
export function rowsInPeriod<T extends { date: string }>(
  rows: T[] | undefined,
  period: Period
) {
  const range = periodMonthRange(period)
  return (rows ?? [])
    .map((row) => ({ row, date: parseDate(row.date) }))
    .filter(
      (x): x is { row: T; date: Date } =>
        x.date !== null && isWithinInterval(x.date, range)
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ row }) => row)
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const mean = (values: number[]) =>
  values.length ? sum(values) / values.length : 0

/** Diesel register totals: Σ quantity, average tariff, Σ amount (old DieselPurchasedTable summary). */
export function dieselPurchaseTotals(rows: DieselPurchase[]) {
  return {
    quantity: sum(rows.map((r) => num(r.quantity))),
    tariff: mean(rows.map((r) => num(r.price_per_litre))),
    amount: sum(rows.map(dieselAmount)),
  }
}

/** Payment register totals. The old table summed tariffs; an average is the
 * meaningful figure, so tariff is averaged like the diesel register. */
export function paymentTotals(rows: Payment[]) {
  return {
    value: sum(rows.map((r) => num(r.value))),
    tariff: mean(rows.map(paymentTariff)),
    amount: sum(rows.map((r) => num(r.amount))),
    vat: sum(rows.map((r) => num(r.vat_inclusive_amount))),
  }
}

/** Utility / IPP overview totals: Σ of each column, average % (old UtilityOverviewCostTrackerTable summary). */
export function utilityOverviewTotals(rows: UtilityOverviewRow[]) {
  const col = (key: keyof UtilityOverviewRow) =>
    sum(rows.map((r) => num(r[key] as Num)))
  return {
    purchased_kwh: col("purchased_kwh"),
    energy_consumed_kwh: col("energy_consumed_kwh"),
    purchased_naira: col("purchased_naira"),
    energy_consumed_naira: col("energy_consumed_naira"),
    difference_kwh: col("difference_kwh"),
    difference_naira: col("difference_naira"),
    percentage: mean(rows.map((r) => num(r.percentage))),
  }
}

/** Diesel overview totals, same rule as the utility table (Σ, average %). */
export function dieselOverviewTotals(rows: DieselOverviewRow[]) {
  const col = (key: keyof DieselOverviewRow) =>
    sum(rows.map((r) => num(r[key] as Num)))
  return {
    inputted_usage: col("inputted_usage"),
    forecasted_usage: col("forecasted_usage"),
    inputted_cost: col("inputted_cost"),
    forecasted_cost: col("forecasted_cost"),
    diesel_difference: col("diesel_difference"),
    cost_difference: col("cost_difference"),
    percentage_usage: mean(rows.map((r) => num(r.percentage_usage))),
  }
}

/** Pre-paid or post-paid? Uses an explicit type if the backend sends one,
 * otherwise a row with a different end date is a post-paid period. */
export function paymentKindOf(row: Payment): "pre-paid" | "post-paid" {
  const type = (row.payment_type ?? row.type ?? "").toLowerCase()
  if (type.includes("post")) return "post-paid"
  if (type.includes("pre")) return "pre-paid"
  return row.end_date && row.end_date !== row.date ? "post-paid" : "pre-paid"
}

export type CostBucket = {
  key: string
  label: string
  tooltipLabel: string
  diesel: number
  utility: number
  ipp: number
}

/**
 * Cost per bucket from the registers: diesel = Σ price × quantity (the old
 * chart summed price_per_litre), utility and IPP = Σ amount. Year → monthly
 * buckets, Month/Day → daily buckets of the month (the granularity rule).
 * Buckets with no rows are 0, so the chart is never empty just because one
 * register is (old chart was empty without utility rows).
 */
export function costBuckets(
  period: Period,
  diesel: DieselPurchase[],
  utility: Payment[],
  ipp: Payment[]
): CostBucket[] {
  const monthly = period.kind === "year"
  const range = periodMonthRange(period)
  const dates = monthly ? monthsInPeriod(period) : eachDayOfInterval(range)
  const keyOf = (d: Date) => format(d, monthly ? "yyyy-MM" : "yyyy-MM-dd")
  const buckets = new Map<string, CostBucket>(
    dates.map((d) => [
      keyOf(d),
      {
        key: keyOf(d),
        label: format(d, monthly ? "MMM" : "d"),
        tooltipLabel: format(d, monthly ? "MMMM yyyy" : "EEE d MMM yyyy"),
        diesel: 0,
        utility: 0,
        ipp: 0,
      },
    ])
  )
  const add = (
    dateText: string,
    field: "diesel" | "utility" | "ipp",
    value: number
  ) => {
    const d = parseDate(dateText)
    const bucket = d ? buckets.get(keyOf(d)) : undefined
    if (bucket) bucket[field] += value
  }
  diesel.forEach((r) => add(r.date, "diesel", dieselAmount(r)))
  utility.forEach((r) => add(r.date, "utility", num(r.amount)))
  ipp.forEach((r) => add(r.date, "ipp", num(r.amount)))
  return [...buckets.values()]
}

export type BaselineBucket = {
  key: string
  label: string
  tooltipLabel: string
  forecast: number
  used: number
}

/**
 * Baseline vs actual: entries grouped by month, Σ forecast and Σ used across
 * the selected devices (old EnergyConsumptionMultipleChart + allCostTrackerBranchesBaseline).
 * `deviceNames` empty means every device.
 */
export function baselineBuckets(
  baseline: Record<string, BaselinePoint[]> | undefined,
  period: Period,
  deviceNames: string[]
): BaselineBucket[] {
  const months = monthsInPeriod(period)
  const buckets = new Map<string, BaselineBucket>(
    months.map((d) => [
      monthKey(d),
      {
        key: monthKey(d),
        label: format(d, "MMM"),
        tooltipLabel: format(d, "MMMM yyyy"),
        forecast: 0,
        used: 0,
      },
    ])
  )
  for (const [device, points] of Object.entries(baseline ?? {})) {
    // The old filter kept devices whose sidebar key ended with the device name.
    if (
      deviceNames.length &&
      !deviceNames.some((name) => name === device || name.endsWith(device))
    )
      continue
    for (const point of points ?? []) {
      const d = parseMonthLabel(point.date)
      const bucket = d ? buckets.get(monthKey(d)) : undefined
      if (!bucket) continue
      bucket.forecast += num(point.forecast)
      bucket.used += num(point.used)
    }
  }
  return [...buckets.values()]
}

/** Old code flattened `generators` (it may hold nested arrays). */
export function flattenGenerators(
  response: GeneratorsResponse | undefined
): Generator[] {
  return (response?.generators ?? [])
    .flat()
    .filter((g): g is Generator => !!g && g.device_id != null)
}

/** "14 Jul 2026" or "14 Jul → 16 Jul 2026" for entries with a real range. */
export function entryDateLabel(
  start: string | null | undefined,
  end?: string | null
) {
  const s = parseDate(start)
  const e = parseDate(end)
  if (!s) return "—"
  if (!e || format(s, "yyyy-MM-dd") === format(e, "yyyy-MM-dd"))
    return format(s, "d MMM yyyy")
  const sameYear = s.getFullYear() === e.getFullYear()
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy")} → ${format(e, "d MMM yyyy")}`
}

/** Monthly entries carry month/year (and maybe start/end dates). */
export function monthlyEntryMonth(entry: {
  month: string | number
  year: string | number
  start_date?: string | null
}) {
  return (
    monthFromParts(entry.month, entry.year) ??
    (entry.start_date ? parseDate(entry.start_date) : null)
  )
}
