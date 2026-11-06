import { isAfter, subDays } from "date-fns"

import type { ReportRequest, ReportType } from "@/lib/api/report-types"
import {
  isoDate,
  periodEnd,
  periodMonthYear,
  periodStart,
  type Period,
  type PeriodKind,
} from "@/lib/period"
import { periodicWeek, type ReportWeek } from "@/lib/report/week"

/**
 * The report type follows the global period. Day → Daily, Month → Monthly.
 * Year still opens the Periodic tab. That report uses the range the user
 * entered; opening the tab starts on the Monday–Sunday week containing
 * today, which they can replace with any start and end.
 *
 * Old Report.js kept one `reportContext` across tabs and didn't clear it, so
 * the Daily tab could preview a stale monthly report. Here the request is a
 * pure function of the period and branch, so it can't go stale.
 */
export const REPORT_TYPE_BY_KIND: Record<PeriodKind, ReportType> = {
  day: "daily",
  month: "monthly",
  year: "periodic",
}

export const KIND_BY_REPORT_TYPE: Record<ReportType, PeriodKind> = {
  daily: "day",
  monthly: "month",
  periodic: "year",
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  daily: "Daily",
  monthly: "Monthly",
  periodic: "Periodic",
}

export function reportRequest(
  period: Period,
  branchId: number,
  type: ReportType = REPORT_TYPE_BY_KIND[period.kind],
  range?: ReportWeek
): ReportRequest {
  if (type === "daily") {
    const day =
      period.kind === "day" ? period : periodForReportType(period, "daily")
    return {
      report_type: "daily",
      branch_id: branchId,
      date: isoDate(periodStart(day)),
    }
  }
  if (type === "monthly") {
    const month =
      period.kind === "month" ? period : periodForReportType(period, "monthly")
    return {
      report_type: "monthly",
      branch_id: branchId,
      ...periodMonthYear(month),
    }
  }
  const week = range ?? periodicWeek(period)
  return {
    report_type: "periodic",
    branch_id: branchId,
    start_date: isoDate(week.start),
    end_date: isoDate(week.end),
  }
}

/** Stable query-key parts for a request. */
export const reportRequestKey = (request: ReportRequest) =>
  Object.entries(request)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")

/**
 * The period to switch to when the user picks a report type on the page.
 * Same anchor rule as the global period picker; a Daily report defaults to
 * yesterday when the current period contains today (the scheduled daily
 * report also covers yesterday).
 */
export function periodForReportType(
  period: Period,
  type: ReportType,
  now = new Date()
): Period {
  const kind = KIND_BY_REPORT_TYPE[type]
  const start = periodStart(period)
  const containsToday =
    !isAfter(start, now) && !isAfter(now, periodEnd(period, now))
  let anchor = containsToday ? now : start
  if (kind === "day" && containsToday) {
    const yesterday = subDays(now, 1)
    anchor = isAfter(start, yesterday) ? now : yesterday
  }
  return { kind, anchor: periodStart({ kind, anchor }) }
}
