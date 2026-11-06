"use client"

import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { format, getDaysInMonth, parseISO } from "date-fns"

import { WholeBranchFilters } from "@/components/filters-provider"
import {
  EmailNote,
  EmailReport,
  EmailSection,
} from "@/components/report/email-report"
import { useClaims } from "@/components/session-provider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDeviceUsage, getTotalEnergy } from "@/lib/api/endpoints"
import type { ReportRequest } from "@/lib/api/report-types"
import type { DeviceUsageResponse } from "@/lib/api/types"
import { sourceUsage, totalEnergy } from "@/lib/dashboard/metrics"
import { formatNaira, formatNumber, formatPercent } from "@/lib/format"
import { isoDate, serializePeriod, type Period } from "@/lib/period"
import {
  avoidedCost,
  breakdownRows,
  gridRate,
  projectedSavings,
  type GroupedSource,
  type SourceGroupId,
} from "@/lib/report/period-content"
import {
  daysInRange,
  elapsedDays,
  previousPeriodicWeek,
  weekSentence,
  weekShort,
  type ReportWeek,
} from "@/lib/report/week"
const ALL: number[] = []

const SOURCE_COLOR: Record<SourceGroupId, string> = {
  generator: "#e15b4a",
  solar: "#3cba6e",
  grid: "#3ec0dc",
  ipp: "#8b7fd6",
}

type PeriodRequest = Exclude<ReportRequest, { report_type: "monthly" }>
type DayQuery<T> = {
  data: T | undefined
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

/**
 * Daily and periodic reports, on the email paper. Periodic uses the start
 * and end dates on the request, whichever range was entered.
 */
export function PeriodReport({ request }: { request: PeriodRequest }) {
  return (
    <WholeBranchFilters>
      {request.report_type === "daily" ? (
        <DailyEmail date={parseISO(request.date)} />
      ) : (
        <PeriodicEmail
          start={parseISO(request.start_date)}
          end={parseISO(request.end_date)}
        />
      )}
    </WholeBranchFilters>
  )
}

function DailyEmail({ date }: { date: Date }) {
  const claims = useClaims()
  const usage = useDayUsage(date)
  const month: Period = { kind: "month", anchor: date }
  const monthUsage = useDayQuery(month, getDeviceUsage)
  const rows = breakdownRows(sourceUsage(usage.data, ALL))
  const total = rows.reduce((sum, row) => sum + row.kwh, 0)
  const rate = gridRate(rows)
  const solar = rows.find((row) => row.id === "solar")?.kwh ?? 0
  const todaySavings = avoidedCost(solar, rate)
  const monthRows = breakdownRows(sourceUsage(monthUsage.data, ALL))
  const monthSavings = avoidedCost(
    monthRows.find((row) => row.id === "solar")?.kwh ?? 0,
    gridRate(monthRows) ?? rate
  )
  const projections = projectedSavings(todaySavings, getDaysInMonth(date))
  const solarTitle = sourceUsage(usage.data, ALL).some(
    (source) => source.deviceType === "SOLAR"
  )

  return (
    <EmailReport
      title={solarTitle ? "Daily Solar Energy Report" : "Daily Energy Report"}
    >
      <div className="flex flex-col gap-1 text-sm">
        <p>Dear {personName(claims)},</p>
        <p>
          On {format(date, "EEEE, d MMMM yyyy")}, the breakdown of your energy
          usage is as follows:
        </p>
      </div>
      <EmailSection title="Energy & Cost Breakdown">
        <DayState query={usage}>
          {total === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No energy data available
            </p>
          )}
          <BreakdownTable rows={rows} />
        </DayState>
      </EmailSection>
      <EmailSection title="Cost Savings from Solar">
        <DayState query={usage}>
          <div className="flex flex-col gap-3">
            <EmailNote tone="savings" title="Today's Savings">
              <p className="font-heading text-3xl font-bold">
                {formatNaira(Math.round(todaySavings))}
              </p>
              <p className="mt-1 text-sm">
                Savings from {formatNumber(solar)} kWh of solar energy
              </p>
            </EmailNote>
            <EmailNote tone="month" title="Current Month Savings">
              {monthUsage.isPending ? (
                <Skeleton className="h-8 w-36" />
              ) : monthUsage.isError ? (
                <Retry onRetry={() => monthUsage.refetch()} />
              ) : (
                <p className="font-heading text-3xl font-bold">
                  {formatNaira(Math.round(monthSavings))}
                </p>
              )}
            </EmailNote>
          </div>
        </DayState>
      </EmailSection>
      <EmailSection title="Projected Savings">
        <DayState query={usage}>
          <p className="text-sm">
            Based on today&apos;s solar performance, here are your projected
            savings:
          </p>
          <Table>
            <TableBody>
              <ProjectionRow
                label="Weekly Projection"
                value={projections.weekly}
              />
              <ProjectionRow
                label="Monthly Projection"
                value={projections.monthly}
              />
              <ProjectionRow
                label="Annual Projection"
                value={projections.annual}
              />
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground italic">
            Projections are estimates based on today&apos;s performance and may
            vary with weather and usage patterns.
          </p>
        </DayState>
      </EmailSection>
    </EmailReport>
  )
}

function PeriodicEmail({ start, end }: { start: Date; end: Date }) {
  const claims = useClaims()
  const week = useMemo<ReportWeek>(() => ({ start, end }), [start, end])
  const previous = useMemo(() => previousPeriodicWeek(week), [week])
  const days = useMemo(() => daysInRange(week), [week])
  const previousDays = useMemo(() => daysInRange(previous), [previous])
  const reportedDays = useMemo(() => elapsedDays(days), [days])
  const current = useDayFigures(reportedDays)
  const prior = useDayFigures(previousDays)
  const usageByDay = useMemo(() => {
    const byDay = new Map<string, DeviceUsageResponse | undefined>()
    reportedDays.forEach((day, index) => {
      byDay.set(isoDate(day), current.usage[index]?.data)
    })
    return byDay
  }, [reportedDays, current.usage])
  const rows = sumGroups(current.usage)
  const priorRows = sumGroups(prior.usage)
  const hasSolar = current.usage.some((query) =>
    sourceUsage(query.data, ALL).some((source) => source.deviceType === "SOLAR")
  )
  const generator = rows.find((row) => row.id === "generator")
  const pending = current.pending || prior.pending
  const failed = current.failed || prior.failed

  return (
    <EmailReport
      title={
        hasSolar ? "Periodic Solar Energy Report" : "Periodic Energy Report"
      }
    >
      <p className="text-center text-sm font-medium">{weekShort(week)}</p>
      <div className="flex flex-col gap-1 text-sm">
        <p>Dear {personName(claims)},</p>
        <p>
          For the period {weekSentence(week)}, the breakdown of your energy
          usage is as follows:
        </p>
      </div>
      {generator && generator.kwh > 0 && generator.naira === 0 && (
        <EmailNote tone="warning" title="Data Entry Compliance Notice">
          <p className="text-sm">
            Generators supplied energy in this period, but no diesel cost is
            recorded, so generator cost shows as {formatNaira(0)}. Log diesel
            entries for the dates in this period so the cost matches what the
            branch reported.
          </p>
        </EmailNote>
      )}
      <FigureState
        pending={pending}
        failed={failed}
        onRetry={() => {
          current.refetch()
          prior.refetch()
        }}
      >
        <EmailSection title="Energy Source Distribution">
          <DistributionBar rows={rows} />
        </EmailSection>
        <EmailSection title="Summary">
          <SummaryTable
            current={rows}
            previous={priorRows}
            currentLabel={weekShort(week)}
            previousLabel={weekShort(previous)}
            currentCarbon={current.carbonTons}
            previousCarbon={prior.carbonTons}
          />
        </EmailSection>
        <EmailSection title="Key Insights">
          <Insights
            rows={rows}
            currentCarbon={current.carbonTons}
            previousCarbon={prior.carbonTons}
            previousLabel={weekShort(previous)}
          />
        </EmailSection>
        <EmailSection title="Daily Energy Usage">
          <DailyUsageTable days={days} usageByDay={usageByDay} />
        </EmailSection>
        <EmailSection title="Daily EMS vs Branch Reported Comparison">
          <p className="text-center text-sm text-muted-foreground">
            No fuel or consumption records available for this period.
          </p>
        </EmailSection>
      </FigureState>
    </EmailReport>
  )
}

function BreakdownTable({ rows }: { rows: GroupedSource[] }) {
  const totalKwh = rows.reduce((sum, row) => sum + row.kwh, 0)
  const totalNaira = rows.reduce((sum, row) => sum + row.naira, 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Energy Source</TableHead>
          <TableHead className="text-right">Energy (kWh)</TableHead>
          <TableHead className="text-right">Cost (₦)</TableHead>
          <TableHead className="text-right">Contribution (%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(row.kwh)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNaira(row.naira)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPercent(row.kwh, totalKwh)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="bg-emerald-50 font-semibold dark:bg-emerald-950/30">
          <TableCell>TOTAL</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNumber(totalKwh)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNaira(totalNaira)}
          </TableCell>
          <TableCell className="text-right tabular-nums">100%</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function ProjectionRow({ label, value }: { label: string; value: number }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatNaira(Math.round(value))}
      </TableCell>
    </TableRow>
  )
}

function DistributionBar({ rows }: { rows: GroupedSource[] }) {
  const shown = rows.filter((row) => row.kwh > 0)
  const total = shown.reduce((sum, row) => sum + row.kwh, 0)
  if (!total) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No energy data available
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {shown.map((row) => (
          <div
            key={row.id}
            style={{
              width: `${(row.kwh / total) * 100}%`,
              backgroundColor: SOURCE_COLOR[row.id],
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        {shown.map((row) => (
          <li key={row.id} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: SOURCE_COLOR[row.id] }}
            />
            {row.label} ({formatPercent(row.kwh, total)})
          </li>
        ))}
      </ul>
    </div>
  )
}

function SummaryTable({
  current,
  previous,
  currentLabel,
  previousLabel,
  currentCarbon,
  previousCarbon,
}: {
  current: GroupedSource[]
  previous: GroupedSource[]
  currentLabel: string
  previousLabel: string
  currentCarbon: number
  previousCarbon: number
}) {
  const now = new Map(current.map((row) => [row.id, row]))
  const then = new Map(previous.map((row) => [row.id, row]))
  const nowTotal = current.reduce((sum, row) => sum + row.kwh, 0)
  const thenTotal = previous.reduce((sum, row) => sum + row.kwh, 0)
  const ids = ["solar", "grid", "generator", "ipp"] as const
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parameters</TableHead>
          <TableHead className="text-right">
            Current Period ({currentLabel})
          </TableHead>
          <TableHead className="text-right">
            Previous Period ({previousLabel})
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ids.map((id) => {
          const row = now.get(id) ?? then.get(id)
          if (!row) return null
          return (
            <TableRow key={id}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right">
                <Amount group={now.get(id)} of={nowTotal} />
              </TableCell>
              <TableCell className="text-right">
                <Amount group={then.get(id)} of={thenTotal} />
              </TableCell>
            </TableRow>
          )
        })}
        <TableRow>
          <TableCell className="font-medium">CO2 Emissions</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNumber(currentCarbon)} tons
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNumber(previousCarbon)} tons
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function Amount({ group, of }: { group?: GroupedSource; of: number }) {
  const kwh = group?.kwh ?? 0
  const naira = group?.naira ?? 0
  return (
    <span className="flex flex-col items-end tabular-nums">
      <span>
        {formatNumber(kwh)} kWh ({formatPercent(kwh, of)})
      </span>
      <span className="text-xs text-muted-foreground">
        {formatNaira(naira)}
      </span>
    </span>
  )
}

function Insights({
  rows,
  currentCarbon,
  previousCarbon,
  previousLabel,
}: {
  rows: GroupedSource[]
  currentCarbon: number
  previousCarbon: number
  previousLabel: string
}) {
  const total = rows.reduce((sum, row) => sum + row.kwh, 0)
  const solar = rows.find((row) => row.id === "solar")?.kwh ?? 0
  const savings = avoidedCost(solar, gridRate(rows))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Solar supplied {formatPercent(solar, total)} of this period&apos;s
        energy ({formatNumber(solar)} kWh). Priced at the grid tariff, that is
        about {formatNaira(Math.round(savings))} that did not have to be bought
        from the grid.
      </p>
      <p className="text-muted-foreground">
        Carbon emissions were {formatNumber(currentCarbon)} tons, against{" "}
        {formatNumber(previousCarbon)} tons in the previous period (
        {previousLabel}).
      </p>
    </div>
  )
}

function DailyUsageTable({
  days,
  usageByDay,
}: {
  days: Date[]
  usageByDay: Map<string, DeviceUsageResponse | undefined>
}) {
  const parsed = days.map((day) => ({
    day,
    rows: breakdownRows(sourceUsage(usageByDay.get(isoDate(day)), ALL)),
  }))
  const showIpp = parsed.some((entry) =>
    entry.rows.some((row) => row.id === "ipp" && row.kwh > 0)
  )
  const columns = [
    "solar",
    "grid",
    "generator",
    ...(showIpp ? ["ipp"] : []),
  ] as const
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {columns.map((id) => (
            <TableHead key={id} className="text-right">
              {id === "ipp" ? "IPP" : id[0].toUpperCase() + id.slice(1)}
            </TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parsed.map(({ day, rows }) => {
          const total = rows.reduce((sum, row) => sum + row.kwh, 0)
          return (
            <TableRow key={isoDate(day)}>
              <TableCell className="font-medium whitespace-nowrap">
                {isoDate(day)}
              </TableCell>
              {columns.map((id) => {
                const row = rows.find((item) => item.id === id)
                return (
                  <TableCell key={id} className="text-right">
                    <UsageCell
                      kwh={row?.kwh ?? 0}
                      naira={row?.naira ?? 0}
                      of={total}
                    />
                  </TableCell>
                )
              })}
              <TableCell className="text-right font-medium tabular-nums">
                {formatNumber(total)} kWh
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function UsageCell({
  kwh,
  naira,
  of,
}: {
  kwh: number
  naira: number
  of: number
}) {
  return (
    <span className="flex flex-col items-end tabular-nums">
      <span>
        {formatNumber(kwh)} kWh ({formatPercent(kwh, of)})
      </span>
      <span className="text-xs text-muted-foreground">
        {formatNaira(naira)}
      </span>
    </span>
  )
}

function useDayUsage(date: Date) {
  return useDayQuery({ kind: "day", anchor: date }, getDeviceUsage)
}

function useDayQuery(
  period: Period,
  fetch: (
    branchId: number,
    period: Period,
    signal?: AbortSignal
  ) => Promise<DeviceUsageResponse>
) {
  const { branch_id: branchId } = useClaims()
  const { view, date } = serializePeriod(period)
  return useQuery({
    queryKey: ["dashboard", "device-usage", branchId, view, date],
    queryFn: ({ signal }) => fetch(branchId, period, signal),
  })
}

function useDayFigures(days: Date[]) {
  const { branch_id: branchId } = useClaims()
  const usage = useQueries({
    queries: days.map((anchor) => {
      const period: Period = { kind: "day", anchor }
      const { view, date } = serializePeriod(period)
      return {
        queryKey: ["dashboard", "device-usage", branchId, view, date],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getDeviceUsage(branchId, period, signal),
      }
    }),
  })
  const carbon = useQueries({
    queries: days.map((anchor) => {
      const period: Period = { kind: "day", anchor }
      const { view, date } = serializePeriod(period)
      return {
        queryKey: ["dashboard", "total-energy", branchId, view, date],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getTotalEnergy(branchId, period, signal),
      }
    }),
  })
  const carbonTons = carbon.reduce(
    (sum, query) => sum + totalEnergy(query.data, ALL).carbonTons,
    0
  )
  return {
    usage,
    carbonTons,
    pending: [...usage, ...carbon].some((query) => query.isPending),
    failed: [...usage, ...carbon].some((query) => query.isError),
    refetch: () => {
      for (const query of usage) query.refetch()
      for (const query of carbon) query.refetch()
    },
  }
}

function sumGroups(queries: DayQuery<DeviceUsageResponse>[]) {
  return breakdownRows(queries.flatMap((query) => sourceUsage(query.data, ALL)))
}

function personName(claims: {
  first_name?: string
  last_name?: string
  username: string
}) {
  const name = [claims.first_name, claims.last_name].filter(Boolean).join(" ")
  return name || claims.username
}

function DayState({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown }
  children: React.ReactNode
}) {
  if (query.isPending) return <Skeleton className="h-40 w-full" />
  if (query.isError) return <Retry onRetry={() => query.refetch()} />
  return children
}

function FigureState({
  pending,
  failed,
  onRetry,
  children,
}: {
  pending: boolean
  failed: boolean
  onRetry: () => void
  children: React.ReactNode
}) {
  if (pending) return <Skeleton className="h-80 w-full" />
  if (failed) return <Retry onRetry={onRetry} />
  return children
}

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="text-sm text-muted-foreground">
      These figures didn&apos;t load.{" "}
      <button type="button" className="text-brand underline" onClick={onRetry}>
        Try again
      </button>
    </p>
  )
}
