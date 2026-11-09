"use client"

import { usePathname, useSearchParams } from "next/navigation"
import {
  format,
  isValid,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns"
import { CalendarClockIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import { EmailVersionDialog } from "@/components/report/email-preview"
import { MonthlyReport } from "@/components/report/monthly-report"
import { PeriodReport } from "@/components/report/period-report"
import { SendReportDialog } from "@/components/report/send-report-dialog"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReportType } from "@/lib/api/report-types"
import {
  isFuturePeriod,
  isoDate,
  periodLabel,
  serializePeriod,
  type Period,
} from "@/lib/period"
import {
  periodForReportType,
  REPORT_TYPE_BY_KIND,
  REPORT_TYPE_LABEL,
  reportRequest,
} from "@/lib/report/report-request"
import {
  periodicWeek,
  reportRangeFromParams,
  type ReportWeek,
} from "@/lib/report/week"

const TYPES: ReportType[] = ["daily", "periodic", "monthly"]

/**
 * /report. Tabs are Daily, Periodic, then Monthly. Each tab has its own
 * date control: a day, a start and end, or a month. Periodic stays on
 * `?report=periodic` so choosing it does not turn the period picker into a
 * year. Reports cover the whole branch, so the device filter doesn't apply.
 * Monthly keeps the report paper; daily and periodic use the email paper.
 * "Email version" shows the email as the backend sends it.
 */
export function ReportView() {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const periodic = searchParams.get("report") === "periodic"
  const type: ReportType = periodic
    ? "periodic"
    : REPORT_TYPE_BY_KIND[period.kind]
  const range =
    reportRangeFromParams(searchParams.get("start"), searchParams.get("end")) ??
    periodicWeek(period)
  const future = type === "daily" && isFuturePeriod(period)
  const request = future
    ? null
    : reportRequest(
        period,
        branchId,
        type,
        type === "periodic" ? range : undefined
      )
  const title =
    request?.report_type === "periodic"
      ? `${format(parseISO(request.start_date), "d MMM")} – ${format(parseISO(request.end_date), "d MMM yyyy")}`
      : periodLabel(period)
  const today = isoDate(new Date())

  const apply = (
    next: Period,
    report: { start: string; end: string } | null
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    const serialized = serializePeriod(next)
    params.set("view", serialized.view)
    params.set("date", serialized.date)
    if (report) {
      params.set("report", "periodic")
      params.set("start", report.start)
      params.set("end", report.end)
    } else {
      params.delete("report")
      params.delete("start")
      params.delete("end")
    }
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`)
  }

  const setDay = (value: string) => {
    const date = parseISO(value)
    if (!isValid(date) || startOfDay(date) > startOfDay(new Date())) return
    apply({ kind: "day", anchor: date }, null)
  }

  const setRange = (next: ReportWeek) => {
    apply(
      { kind: "day", anchor: next.start },
      {
        start: isoDate(next.start),
        end: isoDate(next.end),
      }
    )
  }

  const setMonth = (value: string) => {
    const date = parse(value, "yyyy-MM", new Date())
    if (!isValid(date) || startOfMonth(date) > startOfMonth(new Date())) return
    apply({ kind: "month", anchor: startOfMonth(date) }, null)
  }

  return (
    <>
      <PageHeader
        title="Report"
        description={`${REPORT_TYPE_LABEL[type]} report for ${title}. Reports cover the whole branch.`}
        actions={
          <>
            {request && <EmailVersionDialog request={request} title={title} />}
            <SendReportDialog request={request} title={title} />
          </>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs
          value={type}
          onValueChange={(value) => {
            const next = value as ReportType
            if (next === "periodic") {
              const week = periodicWeek(period)
              setRange(week)
              return
            }
            apply(periodForReportType(period, next), null)
          }}
        >
          <TabsList aria-label="Report type">
            {TYPES.map((t) => (
              <TabsTrigger key={t} value={t} className="px-3">
                {REPORT_TYPE_LABEL[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {type === "daily" && (
          <DateField
            label="Date"
            value={period.kind === "day" ? isoDate(period.anchor) : today}
            max={today}
            onChange={setDay}
          />
        )}
        {type === "periodic" && (
          <div className="flex flex-wrap gap-3">
            <DateField
              label="Start date"
              value={isoDate(range.start)}
              max={isoDate(range.end)}
              onChange={(value) => {
                const start = parseISO(value)
                if (!isValid(start)) return
                const end = start > range.end ? start : range.end
                setRange({ start, end })
              }}
            />
            <DateField
              label="End date"
              value={isoDate(range.end)}
              min={isoDate(range.start)}
              onChange={(value) => {
                const end = parseISO(value)
                if (!isValid(end)) return
                const start = end < range.start ? end : range.start
                setRange({ start, end })
              }}
            />
          </div>
        )}
        {type === "monthly" && (
          <DateField
            label="Month"
            type="month"
            value={format(
              period.kind === "month"
                ? period.anchor
                : startOfMonth(period.anchor),
              "yyyy-MM"
            )}
            max={format(new Date(), "yyyy-MM")}
            onChange={setMonth}
          />
        )}
      </div>

      {!request ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>No report for a future period</EmptyTitle>
            <EmptyDescription>
              Pick today or an earlier day, month or year in the period picker.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : request.report_type === "monthly" ? (
        <MonthlyReport
          branchId={branchId}
          month={request.month}
          year={request.year}
        />
      ) : (
        <PeriodReport request={request} />
      )}
    </>
  )
}

function DateField({
  label,
  value,
  min,
  max,
  type = "date",
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  type?: "date" | "month"
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Input
        type={type}
        value={value}
        min={min}
        max={max}
        className="w-40 bg-card"
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value)
        }}
      />
    </label>
  )
}
