import {
  addDays,
  isAfter,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns"

import { periodEnd, periodStart, type Period } from "@/lib/period"

/** Monday–Sunday, the seven days a periodic report covers. */
export type ReportWeek = { start: Date; end: Date }

/** The Monday–Sunday week containing `anchor`. */
export function reportWeek(anchor: Date): ReportWeek {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return { start, end: addDays(start, 6) }
}

/**
 * The range the periodic report should show for the current global period:
 * a picked range of days as it is, otherwise the Monday–Sunday week
 * containing today (or the period's first day). Never runs past today: the
 * report has nothing for days that haven't happened.
 */
export function periodicWeek(period: Period, now = new Date()): ReportWeek {
  const today = startOfDay(now)
  const start = periodStart(period)
  const week =
    period.kind === "range"
      ? { start, end: startOfDay(periodEnd(period, now)) }
      : reportWeek(
          !isAfter(start, now) && !isAfter(now, periodEnd(period, now))
            ? now
            : start
        )
  return isAfter(week.end, today) ? { ...week, end: today } : week
}

/**
 * A periodic range from `?start=&end=`. Future days are dropped. Null when
 * the values are missing or the start is after the end.
 */
export function reportRangeFromParams(
  start: string | null,
  end: string | null,
  now = new Date()
): ReportWeek | null {
  if (!start || !end) return null
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  if (!isValid(startDate) || !isValid(endDate)) return null
  const today = startOfDay(now)
  const first = startOfDay(startDate)
  let last = startOfDay(endDate)
  if (isAfter(first, today) || isAfter(first, last)) return null
  if (isAfter(last, today)) last = today
  return { start: first, end: last }
}
