import {
  addDays,
  addMonths,
  addYears,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
} from "date-fns"

/**
 * The global period (inventory decisions #1, #2): users pick a calendar
 * Day, Month or Year — at most one year per view — and the period fixes the
 * data granularity.
 */
export type PeriodKind = "day" | "month" | "year"
export type Period = { kind: PeriodKind; anchor: Date }
export type Granularity = "hourly" | "daily" | "monthly"

export const GRANULARITY: Record<PeriodKind, Granularity> = {
  day: "hourly",
  month: "daily",
  year: "monthly",
}

const URL_FORMAT: Record<PeriodKind, string> = {
  day: "yyyy-MM-dd",
  month: "yyyy-MM",
  year: "yyyy",
}

export function defaultPeriod(now = new Date()): Period {
  return { kind: "month", anchor: startOfMonth(now) }
}

export function periodStart({ kind, anchor }: Period) {
  if (kind === "day") return startOfDay(anchor)
  if (kind === "month") return startOfMonth(anchor)
  return startOfYear(anchor)
}

/** End of the calendar period; the current period runs to "now". */
export function periodEnd(period: Period, now = new Date()) {
  const { kind, anchor } = period
  const end =
    kind === "day"
      ? endOfDay(anchor)
      : kind === "month"
        ? endOfMonth(anchor)
        : endOfYear(anchor)
  return isAfter(end, now) && !isAfter(periodStart(period), now) ? now : end
}

export function shiftPeriod(period: Period, step: 1 | -1): Period {
  const shift =
    period.kind === "day" ? addDays : period.kind === "month" ? addMonths : addYears
  return { kind: period.kind, anchor: periodStart({ ...period, anchor: shift(period.anchor, step) }) }
}

export function isFuturePeriod(period: Period, now = new Date()) {
  return isAfter(periodStart(period), now)
}

export function periodLabel({ kind, anchor }: Period) {
  if (kind === "day") return format(anchor, "EEE d MMM yyyy")
  if (kind === "month") return format(anchor, "MMMM yyyy")
  return format(anchor, "yyyy")
}

/** Compact label for narrow screens: "30 Oct 2026", "Oct 2026", "2026". */
export function periodShortLabel({ kind, anchor }: Period) {
  if (kind === "day") return format(anchor, "d MMM yyyy")
  if (kind === "month") return format(anchor, "MMM yyyy")
  return format(anchor, "yyyy")
}

export function serializePeriod({ kind, anchor }: Period) {
  return { view: kind, date: format(anchor, URL_FORMAT[kind]) }
}

export function parsePeriod(view: string | null, date: string | null): Period | null {
  if (view !== "day" && view !== "month" && view !== "year") return null
  if (!date) return null
  const anchor = parse(date, URL_FORMAT[view], new Date())
  return isValid(anchor) ? { kind: view, anchor: periodStart({ kind: view, anchor }) } : null
}

/**
 * The `{start}/{end}` path segment today's endpoints expect:
 * `DD-MM-YYYY HH:mm/DD-MM-YYYY HH:mm`, URL-encoded.
 */
export function endpointRange(period: Period) {
  const fmt = (d: Date) => encodeURIComponent(format(d, "dd-MM-yyyy HH:mm"))
  return `${fmt(periodStart(period))}/${fmt(periodEnd(period))}`
}
