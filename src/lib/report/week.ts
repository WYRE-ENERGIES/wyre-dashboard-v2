import {
  addDays,
  differenceInCalendarDays,
  format,
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

/** The week the periodic report should show for the current global period. */
export function periodicWeek(period: Period, now = new Date()): ReportWeek {
  const start = periodStart(period)
  const containsToday =
    !isAfter(start, now) && !isAfter(now, periodEnd(period, now))
  return reportWeek(containsToday ? now : start)
}

/** The range of the same length immediately before this one. */
export function previousPeriodicWeek(week: ReportWeek): ReportWeek {
  const span = differenceInCalendarDays(week.end, week.start)
  const end = addDays(week.start, -1)
  return { start: addDays(end, -span), end }
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

/** Days in the week that have already happened, today included. */
export function elapsedDays(days: Date[], now = new Date()) {
  const today = startOfDay(now)
  return days.filter((day) => !isAfter(startOfDay(day), today))
}

export function daysInRange({ start, end }: ReportWeek) {
  const days: Date[] = []
  for (let day = start; !isAfter(day, end); day = addDays(day, 1))
    days.push(day)
  return days
}

/** "Monday, 2 November 2026 to Sunday, 8 November 2026". */
export function weekSentence(week: ReportWeek) {
  const day = (date: Date) => format(date, "EEEE, d MMMM yyyy")
  return `${day(week.start)} to ${day(week.end)}`
}

/** "2nd November to 7th November". */
export function weekShort(week: ReportWeek) {
  return `${format(week.start, "do MMMM")} to ${format(week.end, "do MMMM")}`
}
