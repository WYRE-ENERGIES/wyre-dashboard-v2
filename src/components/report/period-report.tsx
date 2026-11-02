"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  ChartBarBigIcon,
  ChartColumnIcon,
  GaugeIcon,
  HistoryIcon,
  PlugZapIcon,
  ReceiptIcon,
} from "lucide-react"

import { EnergyChartBody } from "@/components/dashboard/energy-chart"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { WholeBranchFilters } from "@/components/filters-provider"
import {
  SourceDonut,
  SourceLegend,
  TopContributorsChart,
} from "@/components/report/monthly-charts"
import {
  ReportCard,
  ReportDocument,
  SectionHeading,
  TotalEnergyCard,
  useBranchName,
} from "@/components/report/report-parts"
import { useClaims } from "@/components/session-provider"
import { CardError, Stat } from "@/components/shared/card-parts"
import { Card } from "@/components/ui/card"
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
import { getDeviceUsage } from "@/lib/api/endpoints"
import type { ReportRequest } from "@/lib/api/report-types"
import { seriesColors } from "@/lib/dashboard/colors"
import {
  demandSummary,
  sourceUsage,
  totalEnergy,
  type SourceUsage,
} from "@/lib/dashboard/metrics"
import { formatDeviceName, formatNaira, formatNumber } from "@/lib/format"
import {
  GRANULARITY,
  periodEnd,
  periodLabel,
  periodStart,
  serializePeriod,
  shiftPeriod,
  type Period,
} from "@/lib/period"
import type { Source } from "@/lib/report/monthly"

const ALL: number[] = []

type PeriodRequest = Exclude<ReportRequest, { report_type: "monthly" }>
type Data = ReturnType<typeof useDashboardData>

/**
 * Daily and Periodic reports, in the same document layout as the Monthly
 * report (the old dashboard's report page), built from the dashboard
 * endpoints for the whole branch over the report's period (the global one).
 */
export function PeriodReport({ request }: { request: PeriodRequest }) {
  return (
    <WholeBranchFilters>
      <PeriodReportBody request={request} />
    </WholeBranchFilters>
  )
}

function PeriodReportBody({ request }: { request: PeriodRequest }) {
  const data = useDashboardData()
  const { period } = data
  const branchName = useBranchName()
  const daily = request.report_type === "daily"
  const sources = toSources(sourceUsage(data.deviceUsage.data, ALL))
  const sourcesTotal = sources.reduce((sum, s) => sum + s.kwh, 0)
  const energy = totalEnergy(data.totalEnergy.data, ALL)

  return (
    <ReportDocument
      kind={daily ? "Daily" : "Periodic"}
      branchName={branchName}
      period={coverPeriod(period)}
    >
      {data.totalEnergy.isPending ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : data.totalEnergy.isError ? (
        <Card className="px-6 ring-0">
          <CardError onRetry={() => data.totalEnergy.refetch()} />
        </Card>
      ) : (
        <TotalEnergyCard
          value={energy.totalKwh}
          note={`${formatNumber(energy.solarHoursKwh)} kWh in solar hours (8am–6pm)`}
        />
      )}

      <ReportCard
        title="Energy and cost breakdown"
        icon={ReceiptIcon}
        hint="Energy each source supplied and what it cost. Generator costs need diesel entries; sources without a bill show ₦0."
      >
        <SourcesState query={data.deviceUsage} empty={!sources.length}>
          <BreakdownTable usage={sourceUsage(data.deviceUsage.data, ALL)} />
        </SourcesState>
      </ReportCard>

      <ReportCard
        title="Energy consumed per source"
        icon={PlugZapIcon}
        hint="How your energy consumption was distributed across your power sources, highlighting the one used most."
      >
        <SourcesState query={data.deviceUsage} empty={!sourcesTotal}>
          <SourceDonut sources={sources} />
        </SourcesState>
      </ReportCard>

      <ReportCard
        title="Top energy contributors"
        icon={ChartBarBigIcon}
        description={`${formatNumber(sourcesTotal)} kWh in total`}
        hint="The sources with the most energy consumption in this period."
      >
        <SourcesState query={data.deviceUsage} empty={!sourcesTotal}>
          <div className="flex flex-col gap-4">
            <TopContributorsChart
              sources={[...sources].sort((a, b) => b.kwh - a.kwh)}
            />
            <SourceLegend sources={sources} />
          </div>
        </SourcesState>
      </ReportCard>

      <SectionHeading>Consumption over time</SectionHeading>
      <ReportCard
        title={
          GRANULARITY[period.kind] === "hourly"
            ? "Hourly energy by source"
            : "Monthly energy by source"
        }
        icon={ChartColumnIcon}
        description={`${periodLabel(period)} · kWh`}
        hint={`Energy consumed per ${GRANULARITY[period.kind] === "hourly" ? "hour" : "month"}, split by the source that supplied it.`}
      >
        <EnergyChartBody data={data} />
      </ReportCard>
      <ComparisonCard period={period} current={data.deviceUsage} />

      <SectionHeading>Operational performance</SectionHeading>
      <KeyFigures data={data} />
    </ReportDocument>
  )
}

/** "Sunday, 1 November 2026", or "1 Jan – 2 Nov 2026" for a year so far. */
function coverPeriod(period: Period) {
  if (period.kind === "day") {
    return format(periodStart(period), "EEEE, d MMMM yyyy")
  }
  return `${format(periodStart(period), "d MMM")} – ${format(periodEnd(period), "d MMM yyyy")}`
}

function toSources(usage: SourceUsage[]): Source[] {
  const colors = seriesColors(usage)
  const total = usage.reduce((sum, s) => sum + s.kwh, 0)
  return usage.map((s, index) => ({
    key: String(s.deviceId),
    label: formatDeviceName(s.name),
    kwh: s.kwh,
    color: colors[index],
    percent: total ? (s.kwh / total) * 100 : 0,
  }))
}

function SourcesState({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown }
  empty: boolean
  children: React.ReactNode
}) {
  if (query.isPending) return <Skeleton className="h-52 w-full" />
  if (query.isError) return <CardError onRetry={() => query.refetch()} />
  if (empty) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No source data for this period.
      </p>
    )
  }
  return children
}

function BreakdownTable({ usage }: { usage: SourceUsage[] }) {
  const totalKwh = usage.reduce((sum, s) => sum + s.kwh, 0)
  const totalNaira = usage.reduce((sum, s) => sum + (s.naira ?? 0), 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Energy source</TableHead>
          <TableHead className="text-right">Energy (kWh)</TableHead>
          <TableHead className="text-right">Share</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usage.map((s) => (
          <TableRow key={s.deviceId}>
            <TableCell className="font-medium">
              {formatDeviceName(s.name)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(s.kwh)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {totalKwh ? `${formatNumber((s.kwh / totalKwh) * 100, 1)}%` : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNaira(s.naira ?? 0)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNumber(totalKwh)}
          </TableCell>
          <TableCell className="text-right tabular-nums">100%</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatNaira(totalNaira)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

/** This period against the one before it, per source (the email's
 * comparison uses the previous working day; this uses the previous calendar
 * day, or year). */
function ComparisonCard({
  period,
  current,
}: {
  period: Period
  current: Data["deviceUsage"]
}) {
  const { branch_id: branchId } = useClaims()
  const previousPeriod = shiftPeriod(period, -1)
  const { view, date } = serializePeriod(previousPeriod)
  // Same key as the dashboard's device_usage query, so they share the cache.
  const previous = useQuery({
    queryKey: ["dashboard", "device-usage", branchId, view, date],
    queryFn: ({ signal }) => getDeviceUsage(branchId, previousPeriod, signal),
  })

  const now = sourceUsage(current.data, ALL)
  const before = sourceUsage(previous.data, ALL)
  const rows = now.map((s) => ({
    key: String(s.deviceId),
    label: formatDeviceName(s.name),
    previous: before.find((b) => b.deviceId === s.deviceId)?.kwh ?? 0,
    current: s.kwh,
  }))
  const total = {
    previous: rows.reduce((sum, r) => sum + r.previous, 0),
    current: rows.reduce((sum, r) => sum + r.current, 0),
  }
  const previousLabel = periodLabel(previousPeriod)

  return (
    <ReportCard
      title={`Compared with ${period.kind === "day" ? "the day before" : "the year before"}`}
      icon={HistoryIcon}
      description={`${previousLabel} against ${periodLabel(period)} · kWh`}
      hint="Energy per source in this period and the one before it."
    >
      {current.isPending || previous.isPending ? (
        <Skeleton className="h-52 w-full" />
      ) : current.isError || previous.isError ? (
        <CardError
          onRetry={() => {
            current.refetch()
            previous.refetch()
          }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">{previousLabel}</TableHead>
              <TableHead className="text-right">
                {periodLabel(period)}
              </TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.previous)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.current)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {change(r.previous, r.current)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(total.previous)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(total.current)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {change(total.previous, total.current)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </ReportCard>
  )
}

/** "+12%", "−8%", or "—" when there is nothing to compare against. */
function change(previous: number, current: number) {
  if (!previous) return "—"
  const rounded = Math.round(((current - previous) / previous) * 100)
  if (rounded === 0) return "0%"
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}%`
}

/** Demand, carbon and blended cost: the dashboard's headline figures. */
function KeyFigures({ data }: { data: Data }) {
  const demand = demandSummary(data.demand.data, null)
  const energy = totalEnergy(data.totalEnergy.data, ALL)
  const figures = [
    {
      label: "Max demand",
      query: data.demand,
      value: formatNumber(demand.max, 1),
      unit: "kVA",
    },
    {
      label: "Average demand",
      query: data.demand,
      value: formatNumber(demand.avg, 1),
      unit: "kVA",
    },
    {
      label: "Carbon emissions",
      query: data.totalEnergy,
      value: formatNumber(energy.carbonTons),
      unit: "tons",
    },
    {
      label: "Blended cost of energy",
      query: data.blendedCost,
      value: `₦${formatNumber(data.blendedCost.data?.data)}`,
      unit: "per kWh",
    },
  ]
  return (
    <ReportCard
      title="Key figures"
      icon={GaugeIcon}
      hint="Peak and average power demand help size generators; blended cost is the average cost of a kWh across all sources."
    >
      <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd>
              {f.query.isPending ? (
                <Skeleton className="h-8 w-24" />
              ) : f.query.isError ? (
                <CardError onRetry={() => f.query.refetch()} />
              ) : (
                <Stat value={f.value} unit={f.unit} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </ReportCard>
  )
}
