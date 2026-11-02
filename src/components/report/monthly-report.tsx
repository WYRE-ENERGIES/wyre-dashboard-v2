"use client"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import {
  BandDonut,
  BatteryChart,
  PowerDemandChart,
  SourceDonut,
  SourceLegend,
  TopContributorsChart,
} from "@/components/report/monthly-charts"
import { RingGauge } from "@/components/score-card/ring-gauge"
import {
  CardError,
  InfoHint,
  Stat,
  statCardClass,
} from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { WyreLogo } from "@/components/wyre-logo"
import { getMonthlyReport } from "@/lib/api/report"
import { formatHours, formatNaira, formatNumber } from "@/lib/format"
import {
  monthlyReportModel,
  type MonthlyReportModel,
} from "@/lib/report/monthly"
import { cn } from "@/lib/utils"

/** The in-app monthly report: every section of the old MonthlyReport .js,
 * in its order (inventory 04 §4.4). */
export function MonthlyReport({
  branchId,
  month,
  year,
}: {
  branchId: number
  month: number
  year: number
}) {
  const query = useQuery({
    queryKey: ["report", "monthly", branchId, month, year],
    queryFn: ({ signal }) => getMonthlyReport(branchId, month, year, signal),
    select: monthlyReportModel,
  })

  if (query.isPending) return <MonthlyReportSkeleton />
  if (query.isError) {
    return (
      <Card>
        <CardContent>
          <CardError onRetry={() => query.refetch()} />
        </CardContent>
      </Card>
    )
  }
  return <MonthlyReportBody report={query.data} />
}

function MonthlyReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight">
      {children}
    </h2>
  )
}

function ReportCard({
  title,
  hint,
  description,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          {action}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {hint && (
          <CardAction>
            <InfoHint>{hint}</InfoHint>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

const right = { meta: { align: "right" } } as const
const kwh = (v: number) => formatNumber(v)

// ---------------------------------------------------------------------------

function MonthlyReportBody({ report }: { report: MonthlyReportModel }) {
  return (
    <div className="flex flex-col gap-4">
      {/* §1 Cover */}
      <Card className="bg-primary text-primary-foreground ring-0">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-primary-foreground/80">
              Monthly energy report
            </span>
            <span className="font-heading text-2xl font-semibold">
              {report.branchName || "Your branch"}
            </span>
            <span className="text-primary-foreground/80">
              {report.month} {report.year}
            </span>
          </div>
          <span className="flex items-center gap-2 text-xs text-primary-foreground/80">
            powered by <WyreLogo className="h-5" />
          </span>
        </CardContent>
      </Card>

      {/* §2 Total energy, §3 per source, §4 top contributors (non-solar) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={cn(
            "flex flex-col gap-4",
            report.isSolar &&
              "lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
          )}
        >
          <Card className={statCardClass}>
            <CardHeader>
              <CardDescription>Total energy consumed</CardDescription>
              {report.isSolar && (
                <CardAction>
                  <InfoHint>
                    Includes the energy your solar system generated.
                  </InfoHint>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <Stat
                value={formatNumber(report.totalEnergy)}
                unit={report.totalEnergyUnit}
                className="text-3xl"
              />
            </CardContent>
          </Card>
          <ReportCard
            title="Energy consumed per source"
            hint="How your energy consumption was distributed across your power sources, highlighting the one used most."
          >
            {report.sourcesTotal > 0 ? (
              <SourceDonut sources={report.sources} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No source consumption recorded this month.
              </p>
            )}
          </ReportCard>
        </div>
        {!report.isSolar && (
          <ReportCard
            title={`Top ${report.sources.length > 7 ? "7 " : ""}energy contributors`}
            description={`${formatNumber(report.totalEnergy)} ${report.totalEnergyUnit} in total`}
            hint="The sources with the most energy consumption this month."
          >
            {report.sourcesTotal > 0 ? (
              <div className="flex flex-col gap-4">
                <TopContributorsChart sources={report.topContributors} />
                <SourceLegend sources={report.topContributors} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No source consumption recorded this month.
              </p>
            )}
          </ReportCard>
        )}
      </div>

      {/* §5 Consumption metrics */}
      <SectionHeading>Consumption metrics</SectionHeading>
      {report.solar && <SolarSavings solar={report.solar} />}
      {report.battery && <BatteryUsage battery={report.battery} />}
      <UtilityTable rows={report.utilityRows} />
      <DieselTable months={report.dieselMonths} />
      {report.solarHours && (
        <ReportCard
          title="Solar hours consumption"
          hint="Energy consumed during sunshine hours (8am–6pm): the potential savings if you deploy solar."
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col">
              <dt className="text-sm text-muted-foreground">
                Energy consumed during solar hours
              </dt>
              <dd>
                <Stat
                  value={formatNumber(report.solarHours.kwh)}
                  unit={report.solarHours.unit}
                />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm text-muted-foreground">
                Share of total energy
              </dt>
              <dd>
                <Stat
                  value={`${formatNumber(report.solarHours.percentOfTotal, 1)}%`}
                />
              </dd>
            </div>
          </dl>
        </ReportCard>
      )}

      {/* §6 Operational performance */}
      <SectionHeading>Operational performance</SectionHeading>
      <ReportCard
        title="Power demand"
        description={
          report.isResidential
            ? "Weekdays and weekends"
            : "Operational, non-operational and weekend hours"
        }
        hint={
          report.isResidential
            ? "Power demand on weekdays and weekends. With other factors, it helps size a generator or solar system."
            : "Power demand during operational hours, non-operational hours and weekends. With other factors, it helps size a generator."
        }
      >
        <PowerDemandChart demand={report.powerDemand} />
      </ReportCard>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {!report.isSolar && (
          <ReportCard
            title="Energy usage breakdown"
            hint="Helps you plan an alternative energy source, especially for weekends, to cut cost."
          >
            <DataTable
              pageSize={false}
              data={report.powerDemand.breakdown}
              columns={breakdownColumns}
              footer={{
                category: "Total",
                energyKwh: kwh(
                  report.powerDemand.breakdown.reduce(
                    (s, r) => s + r.energyKwh,
                    0
                  )
                ),
                percent: "100%",
              }}
            />
          </ReportCard>
        )}
        {report.deviationRows.length > 0 && (
          <ReportCard
            title="Deviation energy and cost"
            hint="Time, energy and cost wasted by running generators outside operating hours."
            className={report.isSolar ? "xl:col-span-2" : undefined}
          >
            <DataTable
              pageSize={false}
              data={report.deviationRows}
              columns={deviationColumns}
            />
          </ReportCard>
        )}
      </div>

      {/* §7 Efficiency and supply */}
      {report.generatorSizeEfficiency && (
        <GeneratorSizeEfficiency
          g={report.generatorSizeEfficiency}
          month={report.month}
        />
      )}
      {report.fuelEfficiency && (
        <ReportCard
          title="Fuel efficiency accuracy comparison"
          action={
            <Badge variant="secondary">
              Accuracy {formatNumber(report.fuelEfficiency.accuracy, 1)}
              {report.fuelEfficiency.accuracyUnit}
            </Badge>
          }
        >
          <dl className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <dt className="text-sm text-muted-foreground">Recommended</dt>
              <dd>
                <Stat
                  value={formatNumber(report.fuelEfficiency.recommended, 3)}
                  unit={report.fuelEfficiency.recommendedUnit}
                />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-sm text-muted-foreground">Achieved</dt>
              <dd>
                <Stat
                  value={formatNumber(report.fuelEfficiency.achieved, 3)}
                  unit={report.fuelEfficiency.achievedUnit}
                />
              </dd>
            </div>
          </dl>
        </ReportCard>
      )}
      {report.bands && (
        <ReportCard
          title="Band categorisation"
          action={<Badge>Band {report.bands.letter}</Badge>}
          hint="Utility supply hours against the hours your tariff band promises. Band from achieved hours: over 540 h A, over 432 h B, over 324 h C, over 216 h D, otherwise E."
        >
          <DataTable
            pageSize={false}
            data={report.bands.rows}
            columns={bandColumns}
          />
        </ReportCard>
      )}
      {(report.bands || report.dataEntry != null) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {report.bands && (
            <ReportCard
              title="Utility supply hours"
              description="Hours supplied against blackout hours"
            >
              <div className="flex justify-center">
                <BandDonut bands={report.bands} />
              </div>
            </ReportCard>
          )}
          {report.dataEntry != null && (
            <ReportCard
              title="Data entry score"
              description="Based on how complete the system inputs are"
            >
              <div className="flex justify-center">
                <RingGauge
                  percent={report.dataEntry}
                  label={`${formatNumber(report.dataEntry, 0)}${report.dataEntryUnit}`}
                  caption="complete"
                  size={168}
                />
              </div>
            </ReportCard>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// §5a Solar savings

function SolarSavings({
  solar,
}: {
  solar: NonNullable<MonthlyReportModel["solar"]>
}) {
  const change = solar.savingsChangePercent
  const rows = [...solar.rows, ...solar.projections]
  return (
    <ReportCard
      title="Solar savings impact"
      hint="How much of your energy came from solar, the energy it generated, and the money saved by not drawing it from the grid or a generator."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            This month&apos;s savings
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Stat
              value={formatNaira(Math.round(solar.current.savings))}
              className="text-3xl"
            />
            {change != null && (
              <Badge variant={change >= 0 ? "default" : "destructive"}>
                {change >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                {formatNumber(Math.abs(change), 1)}% vs last month
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {formatNumber(solar.current.energyKwh, 0)} kWh generated ·{" "}
            {formatNumber(solar.current.contribution, 1)}% of total energy
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Solar contribution</TableHead>
              <TableHead className="text-right">
                Energy generated (kWh)
              </TableHead>
              <TableHead className="text-right">Estimated savings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={r.label}
                className={i >= solar.rows.length ? "bg-muted/40" : undefined}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{r.label}</span>
                    {r.detail && (
                      <span className="text-xs text-muted-foreground">
                        {r.detail}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.contribution == null
                    ? "—"
                    : `${formatNumber(r.contribution, 1)}%`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.energyKwh, 0)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatNaira(Math.round(r.savings))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportCard>
  )
}

// ---------------------------------------------------------------------------
// §5b Battery daily usage

function BatteryUsage({
  battery,
}: {
  battery: NonNullable<MonthlyReportModel["battery"]>
}) {
  return (
    <ReportCard title="Battery daily usage" description={battery.caption}>
      <div className="flex flex-col gap-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col">
            <dt className="text-sm text-muted-foreground">Energy delivered</dt>
            <dd className="flex flex-col">
              <Stat value={formatNumber(battery.totalEnergy, 1)} unit="kWh" />
              <span className="text-xs text-muted-foreground">
                over {battery.days} {battery.days === 1 ? "day" : "days"}
              </span>
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-muted-foreground">
              Avg. discharge time
            </dt>
            <dd className="flex flex-col">
              <Stat value={formatHours(battery.avgHours)} unit="/ day" />
              <span className="text-xs text-muted-foreground">
                Total {formatHours(battery.totalHours)}
              </span>
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-muted-foreground">Avg. max SOC</dt>
            <dd className="flex flex-col">
              <Stat value={`${formatNumber(battery.avgMaxSoc, 0)}%`} />
              <span className="text-xs text-muted-foreground">
                Higher is better
              </span>
            </dd>
          </div>
        </dl>
        <BatteryChart battery={battery} />
      </div>
    </ReportCard>
  )
}

// ---------------------------------------------------------------------------
// §5c Utility consumption

type UtilityRow = MonthlyReportModel["utilityRows"][number]
const utilityColumns: ColumnDef<UtilityRow, unknown>[] = [
  { accessorKey: "month", header: "Month" },
  {
    accessorKey: "discoKwh",
    header: "Disco energy (kWh)",
    cell: (c) => kwh(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "wyreKwh",
    header: "Wyre meter (kWh)",
    cell: (c) => kwh(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "expectedBill",
    header: "Expected bill",
    cell: (c) => formatNaira(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "discoCost",
    header: "Disco cost",
    cell: (c) => formatNaira(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "usageAccuracy",
    header: "Usage accuracy",
    cell: (c) => `${formatNumber(c.getValue<number>(), 1)}%`,
    ...right,
  },
]

function UtilityTable({ rows }: { rows: UtilityRow[] }) {
  return (
    <ReportCard
      title="Utility consumption"
      hint="Compares the energy your Disco billed with the energy Wyre's meter recorded, so you're not overcharged."
    >
      <DataTable
        pageSize={false}
        data={rows}
        columns={utilityColumns}
        emptyText="No utility consumption in the last three months."
      />
    </ReportCard>
  )
}

// ---------------------------------------------------------------------------
// §5d Diesel consumption (month, actual usage and actual cost span the
// month's generator rows)

function DieselTable({
  months,
}: {
  months: MonthlyReportModel["dieselMonths"]
}) {
  return (
    <ReportCard
      title="Diesel consumption"
      hint="Monthly diesel usage and cost. Optimise through reduced loads, limited use outside working hours, and regular maintenance."
    >
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No generator consumption in the last three months.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Actual usage (L)</TableHead>
                <TableHead>Generator</TableHead>
                <TableHead className="text-right">Energy (kWh)</TableHead>
                <TableHead className="text-right">Optimal usage (L)</TableHead>
                <TableHead className="text-right">Actual cost</TableHead>
                <TableHead className="text-right">Optimal cost</TableHead>
                <TableHead className="text-right">Usage accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.flatMap((m) =>
                m.entries.map((e, i) => (
                  <TableRow key={e.key}>
                    {i === 0 && (
                      <>
                        <TableCell
                          rowSpan={m.entries.length}
                          className="align-top font-medium"
                        >
                          {m.month}
                        </TableCell>
                        <TableCell
                          rowSpan={m.entries.length}
                          className="text-right align-top tabular-nums"
                        >
                          {formatNumber(m.actualLitres)}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {e.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kwh(e.energyKwh)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(e.optimalLitres)}
                    </TableCell>
                    {i === 0 && (
                      <TableCell
                        rowSpan={m.entries.length}
                        className="text-right align-top tabular-nums"
                      >
                        {formatNaira(m.actualCost)}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">
                      {formatNaira(e.optimalCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(e.accuracy, 2)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportCard>
  )
}

// ---------------------------------------------------------------------------
// §6b, §6c, §7c tables

type BreakdownRow = MonthlyReportModel["powerDemand"]["breakdown"][number]
const breakdownColumns: ColumnDef<BreakdownRow, unknown>[] = [
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "energyKwh",
    header: "Energy (kWh)",
    cell: (c) => kwh(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "percent",
    header: "Share of total",
    cell: (c) => `${formatNumber(c.getValue<number>(), 1)}%`,
    ...right,
  },
]

type DeviationRow = MonthlyReportModel["deviationRows"][number]
const deviationColumns: ColumnDef<DeviationRow, unknown>[] = [
  { accessorKey: "month", header: "Month" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "energyKwh",
    header: "Energy (kWh)",
    cell: (c) => kwh(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "hours",
    header: "Time of use",
    cell: (c) => formatHours(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "dieselLitres",
    header: "Diesel (L)",
    cell: (c) => formatNumber(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "costNaira",
    header: "Cost",
    cell: (c) => formatNaira(c.getValue<number>()),
    ...right,
  },
]

type BandRow = NonNullable<MonthlyReportModel["bands"]>["rows"][number]
const bandColumns: ColumnDef<BandRow, unknown>[] = [
  { accessorKey: "band", header: "Band" },
  {
    accessorKey: "expectedHours",
    header: "Expected hours",
    cell: (c) => formatNumber(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "totalHours",
    header: "Achieved hours",
    cell: (c) => formatNumber(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "blackoutHours",
    header: "Blackout (h)",
    cell: (c) => formatNumber(c.getValue<number>()),
    ...right,
  },
  {
    accessorKey: "compliance",
    header: "Compliance",
    cell: (c) => `${formatNumber(c.getValue<number>(), 1)}%`,
    ...right,
  },
]

// ---------------------------------------------------------------------------
// §7a Generator size efficiency accuracy

function GeneratorSizeEfficiency({
  g,
  month,
}: {
  g: NonNullable<MonthlyReportModel["generatorSizeEfficiency"]>
  month: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className={statCardClass}>
        <CardHeader>
          <CardDescription>
            {month
              ? `${month} generator size efficiency`
              : "This month's generator size efficiency"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Stat value={`${formatNumber(g.current, 2)}${g.unit}`} />
          <Badge variant={g.change >= 0 ? "default" : "destructive"}>
            {g.change >= 0 ? "+" : "−"}
            {formatNumber(Math.abs(g.change), 2)}
            {g.unit} vs last month
          </Badge>
        </CardContent>
      </Card>
      <Card className={statCardClass}>
        <CardHeader>
          <CardDescription>Best ever efficiency</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <Stat value={`${formatNumber(g.best, 2)}${g.bestUnit}`} />
          {g.bestDate && (
            <span className="text-xs text-muted-foreground">
              Achieved in {g.bestDate}
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
