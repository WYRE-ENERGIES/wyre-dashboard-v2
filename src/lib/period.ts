import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isSameMonth,
  isSameYear,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
} from "date-fns"

/**
 * The global period (inventory decisions #1, #2): users pick a calendar
 * Day, Month or Year — at most one year per view — or, under Day, a range of
 * up to 30 days. The period fixes the data granularity: one day is hourly, a
 * range or a month daily, a year monthly.
 */
export type PeriodKind = "day" | "range" | "month" | "year"
/** `end` is the last day of a "range" (inclusive); other kinds ignore it. */
export type Period = { kind: PeriodKind; anchor: Date; end?: Date }
export type Granularity = "hourly" | "daily" | "monthly"

export const GRANULARITY: Record<PeriodKind, Granularity> = {
  day: "hourly",
  range: "daily",
  month: "daily",
  year: "monthly",
}

/** The longest range a Day view can cover, in days (inclusive). */
export const MAX_RANGE_DAYS = 30

const URL_FORMAT: Record<PeriodKind, string> = {
  day: "yyyy-MM-dd",
  range: "yyyy-MM-dd",
  month: "yyyy-MM",
  year: "yyyy",
}
/** Joins a range's first and last day in the URL: 2026-11-02..2026-11-06. */
const RANGE_SEPARATOR = ".."

/**
 * A Day-view selection from `from` to `to` (inclusive, either order). The
 * same day gives a single "day"; longer spans are capped at MAX_RANGE_DAYS
 * from the first day.
 */
export function dayRange(from: Date, to: Date = from): Period {
  const [first, last] = isAfter(from, to) ? [to, from] : [from, to]
  const start = startOfDay(first)
  const days = differenceInCalendarDays(last, first) + 1
  if (days <= 1) return { kind: "day", anchor: start }
  const end = startOfDay(
    days > MAX_RANGE_DAYS ? addDays(first, MAX_RANGE_DAYS - 1) : last
  )
  return { kind: "range", anchor: start, end }
}

/** Day and range periods both sit under the picker's "Day" option. */
export const isDayView = (period: Period) =>
  period.kind === "day" || period.kind === "range"

/** Number of calendar days a range covers (1 for anything else). */
export const rangeDays = (period: Period) =>
  period.kind === "range" && period.end
    ? differenceInCalendarDays(period.end, period.anchor) + 1
    : 1

export function defaultPeriod(now = new Date()): Period {
  return { kind: "month", anchor: startOfMonth(now) }
}

export function periodStart({ kind, anchor }: Period) {
  if (kind === "day" || kind === "range") return startOfDay(anchor)
  if (kind === "month") return startOfMonth(anchor)
  return startOfYear(anchor)
}

/** End of the calendar period; the current period runs to "now". */
export function periodEnd(period: Period, now = new Date()) {
  const end = periodFullEnd(period)
  return isAfter(end, now) && !isAfter(periodStart(period), now) ? now : end
}

/** End of the whole calendar period, ignoring "now". */
export function periodFullEnd({ kind, anchor, end }: Period) {
  if (kind === "day") return endOfDay(anchor)
  if (kind === "range") return endOfDay(end ?? anchor)
  if (kind === "month") return endOfMonth(anchor)
  return endOfYear(anchor)
}

export function shiftPeriod(period: Period, step: 1 | -1): Period {
  if (period.kind === "range") {
    // Moves by the range's own length: 2–6 Nov → 7–11 Nov.
    const days = rangeDays(period) * step
    return dayRange(
      addDays(period.anchor, days),
      addDays(period.end ?? period.anchor, days)
    )
  }
  const shift =
    period.kind === "day"
      ? addDays
      : period.kind === "month"
        ? addMonths
        : addYears
  return {
    kind: period.kind,
    anchor: periodStart({ ...period, anchor: shift(period.anchor, step) }),
  }
}

export function isFuturePeriod(period: Period, now = new Date()) {
  return isAfter(periodStart(period), now)
}

/** "2 – 6 Nov 2026", "28 Oct – 3 Nov 2026", "29 Dec 2025 – 4 Jan 2026". */
function rangeLabel(start: Date, end: Date, short = false) {
  const year = short ? "" : " yyyy"
  if (isSameMonth(start, end))
    return `${format(start, "d")} – ${format(end, `d MMM${year}`)}`
  if (isSameYear(start, end))
    return `${format(start, "d MMM")} – ${format(end, `d MMM${year}`)}`
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`
}

export function periodLabel({ kind, anchor, end }: Period) {
  if (kind === "range") return rangeLabel(anchor, end ?? anchor)
  if (kind === "day") return format(anchor, "EEE d MMM yyyy")
  if (kind === "month") return format(anchor, "MMMM yyyy")
  return format(anchor, "yyyy")
}

/** Calendar month (1–12) and year of the period's start — for endpoints that
 * take `?month=&year=` (Diesel, Solar, Report). */
export function periodMonthYear(period: Period) {
  const start = periodStart(period)
  return { month: start.getMonth() + 1, year: start.getFullYear() }
}

/** `yyyy-MM-dd`, for endpoints and forms that take ISO dates. */
export const isoDate = (date: Date) => format(date, "yyyy-MM-dd")

/** Compact label for narrow screens: "30 Oct 2026", "Oct 2026", "2026". */
export function periodShortLabel({ kind, anchor, end }: Period) {
  if (kind === "range") return rangeLabel(anchor, end ?? anchor, true)
  if (kind === "day") return format(anchor, "d MMM yyyy")
  if (kind === "month") return format(anchor, "MMM yyyy")
  return format(anchor, "yyyy")
}

/** URL / query-key form. A range's `date` holds both days, so every query
 * keyed on `[view, date]` tells ranges apart. */
export function serializePeriod({ kind, anchor, end }: Period) {
  const date = format(anchor, URL_FORMAT[kind])
  return {
    view: kind,
    date:
      kind === "range" && end
        ? `${date}${RANGE_SEPARATOR}${format(end, URL_FORMAT.range)}`
        : date,
  }
}

export function parsePeriod(
  view: string | null,
  date: string | null
): Period | null {
  if (view !== "day" && view !== "range" && view !== "month" && view !== "year")
    return null
  if (!date) return null
  if (view === "range") {
    const [from, to] = date
      .split(RANGE_SEPARATOR)
      .map((d) => parse(d, URL_FORMAT.range, new Date()))
    return from && to && isValid(from) && isValid(to)
      ? dayRange(from, to)
      : null
  }
  const anchor = parse(date, URL_FORMAT[view], new Date())
  return isValid(anchor)
    ? { kind: view, anchor: periodStart({ kind: view, anchor }) }
    : null
}

/**
 * The `{start}/{end}` path segment today's endpoints expect:
 * `DD-MM-YYYY HH:mm/DD-MM-YYYY HH:mm`, URL-encoded.
 */
export function endpointRange(period: Period) {
  const fmt = (d: Date) => encodeURIComponent(format(d, "dd-MM-yyyy HH:mm"))
  return `${fmt(periodStart(period))}/${fmt(periodEnd(period))}`
}
