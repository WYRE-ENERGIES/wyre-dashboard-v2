"use client"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, PlugZapIcon, ZapOffIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  CardError,
  InfoHint,
  Stat,
  ValueSkeleton,
  statCardClass,
} from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { getSideBar } from "@/lib/api/endpoints"
import { getLoadDemand, getLoadOverview } from "@/lib/api/load-overview"
import { downloadCsv, fileSlug } from "@/lib/export"
import { formatDeviceName, formatHours, formatNumber } from "@/lib/format"
import { visibleNav } from "@/lib/gating"
import {
  loadColor,
  loadOverview,
  type LoadRow,
} from "@/lib/load-overview/metrics"
import { periodLabel, serializePeriod } from "@/lib/period"

export function LoadOverviewView() {
  const claims = useClaims()
  if (!visibleNav(claims).has("load-overview")) {
    return (
      <>
        <PageHeader title="Load Overview" />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ZapOffIcon />
            </EmptyMedia>
            <EmptyTitle>No energy monitoring on this account</EmptyTitle>
            <EmptyDescription>
              Load Overview is part of Wyre energy monitoring. Contact Wyre to
              add it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }
  return <LoadOverviewContent branchId={claims.branch_id} />
}

function LoadOverviewContent({ branchId }: { branchId: number }) {
  const { period, selectedDeviceIds, setSelectedDeviceIds } = useFilters()
  const { view, date } = serializePeriod(period)

  const overview = useQuery({
    queryKey: ["load-overview", branchId, view, date],
    queryFn: ({ signal }) => getLoadOverview(branchId, period, signal),
  })
  const demand = useQuery({
    queryKey: ["load-overview", "demand", branchId, view, date],
    queryFn: ({ signal }) => getLoadDemand(branchId, period, signal),
  })
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const selectedNames = (
    sideBar.data?.authenticatedData.branches[0]?.devices ?? []
  )
    .filter((d) => selectedDeviceIds.includes(d.device_id))
    .map((d) => d.name)

  const model = loadOverview(
    overview.data,
    demand.data,
    selectedDeviceIds,
    selectedNames
  )
  const branchName = overview.data?.authenticatedData.branches[0]?.name
  const filtered = selectedDeviceIds.length > 0

  const exportCsv = () =>
    downloadCsv(
      fileSlug("load-overview", branchName ?? "branch", periodLabel(period)),
      [
        { key: "load", label: "Load" },
        { key: "kwh", label: "Consumption (kWh)" },
        { key: "share", label: "Share of loads (%)" },
        { key: "building", label: "Share of building energy (%)" },
        {
          key: "max",
          label: `Max demand (${model.rows[0]?.demand?.unit ?? "kVA"})`,
        },
        { key: "avg", label: "Avg demand" },
        { key: "min", label: "Min demand" },
        { key: "hours", label: "Running time (h)" },
      ],
      model.rows.map((r) => ({
        load: formatDeviceName(r.name),
        kwh: Math.round(r.kwh * 100) / 100,
        share: Math.round(r.shareOfLoads * 100) / 100,
        building: Math.round(r.shareOfBuilding * 100) / 100,
        max: r.demand ? Math.round(r.demand.max * 100) / 100 : "",
        avg: r.demand ? Math.round(r.demand.avg * 100) / 100 : "",
        min: r.demand ? Math.round(r.demand.min * 100) / 100 : "",
        hours: Math.round(r.runtimeHours * 100) / 100,
      }))
    )

  const header = (
    <PageHeader
      title="Load Overview"
      description={`Consumption and running time of each load meter${branchName ? ` at ${branchName}` : ""} · ${periodLabel(period)}`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={!model.rows.length}
        >
          <DownloadIcon />
          CSV
        </Button>
      }
    />
  )

  if (overview.isError) {
    return (
      <>
        {header}
        <Card>
          <CardContent>
            <CardError onRetry={() => overview.refetch()} />
          </CardContent>
        </Card>
      </>
    )
  }

  if (overview.isSuccess && !model.hasLoadMeters) {
    return (
      <>
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugZapIcon />
            </EmptyMedia>
            <EmptyTitle>No load meters on this branch</EmptyTitle>
            <EmptyDescription>
              Load Overview breaks consumption down by load meter, such as HVAC
              or lighting. This branch only has source meters (grid, generators,
              solar). Contact Wyre to add load metering.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  const loading = overview.isPending

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Building energy"
          hint="Energy supplied by every source meter (grid, generators, solar) in the period."
          loading={loading}
          value={formatNumber(model.buildingKwh)}
          unit="kWh"
        />
        <KpiCard
          title="Load consumption"
          hint={
            filtered
              ? "Energy used by the selected load meters."
              : "Energy used by all load meters."
          }
          loading={loading}
          value={formatNumber(model.loadKwh)}
          unit="kWh"
        />
        <KpiCard
          title="Load share of building"
          hint="Load consumption ÷ building energy. The rest is unmetered or losses."
          loading={loading}
          value={formatNumber(model.percentLoad)}
          unit="%"
        />
      </div>

      {!loading && model.rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              None of the selected devices are load meters
            </EmptyTitle>
            <EmptyDescription>
              The device filter only has sources ticked. Clear it to see every
              load.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setSelectedDeviceIds([])}>
              Show all loads
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <RuntimeChart rows={model.rows} loading={loading} />
            <ShareChart
              rows={model.rows}
              total={model.loadKwh}
              loading={loading}
            />
          </div>
          <LoadTable
            rows={model.rows}
            loading={loading}
            demandLoading={demand.isPending}
          />
        </>
      )}
    </>
  )
}

function KpiCard({
  title,
  hint,
  loading,
  value,
  unit,
}: {
  title: string
  hint: string
  loading: boolean
  value: string
  unit: string
}) {
  return (
    <Card size="sm" className={statCardClass}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <InfoHint>{hint}</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? <ValueSkeleton /> : <Stat value={value} unit={unit} />}
      </CardContent>
    </Card>
  )
}

function RuntimeChart({
  rows,
  loading,
}: {
  rows: LoadRow[]
  loading: boolean
}) {
  const data = rows.map((r, i) => ({
    name: formatDeviceName(r.name),
    hours: r.runtimeHours,
    fill: loadColor(i),
  }))
  const config: ChartConfig = { hours: { label: "Running time" } }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Running time</CardTitle>
        <CardDescription>Hours each load drew power</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: Math.max(160, data.length * 40) }}
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 4, right: 16 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${formatNumber(v, 0)} h`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={96}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(value) => (
                      <span className="font-mono tabular-nums">
                        {formatHours(Number(value))}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/** Up to six slices; smaller loads are grouped as "Other". */
function ShareChart({
  rows,
  total,
  loading,
}: {
  rows: LoadRow[]
  total: number
  loading: boolean
}) {
  const top = rows.slice(0, 6)
  const rest = rows.slice(6).reduce((acc, r) => acc + r.kwh, 0)
  const slices = [
    ...top.map((r, i) => ({
      key: r.key,
      name: formatDeviceName(r.name),
      kwh: r.kwh,
      fill: loadColor(i),
    })),
    ...(rest > 0
      ? [
          {
            key: "other",
            name: "Other",
            kwh: rest,
            fill: "var(--muted-foreground)",
          },
        ]
      : []),
  ]
  const config: ChartConfig = Object.fromEntries(
    slices.map((s) => [s.key, { label: s.name, color: s.fill }])
  )
  const pct = (kwh: number) => (total ? (kwh / total) * 100 : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption share</CardTitle>
        <CardDescription>
          Each load&apos;s share of load consumption
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="mx-auto size-48 rounded-full" />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartContainer
              config={config}
              className="aspect-square h-48 shrink-0"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono tabular-nums">
                            {formatNumber(Number(value))} kWh ·{" "}
                            {formatNumber(pct(Number(value)), 1)}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={
                    total
                      ? slices
                      : [
                          {
                            key: "none",
                            name: "No use",
                            kwh: 1,
                            fill: "var(--muted)",
                          },
                        ]
                  }
                  dataKey="kwh"
                  nameKey="name"
                  innerRadius={56}
                  strokeWidth={4}
                >
                  {(total
                    ? slices
                    : [{ key: "none", fill: "var(--muted)" }]
                  ).map((s) => (
                    <Cell key={s.key} fill={s.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex w-full min-w-0 flex-col gap-2 text-sm">
              {slices.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ background: s.fill }}
                  />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                    {formatNumber(pct(s.kwh), 1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LoadTable({
  rows,
  loading,
  demandLoading,
}: {
  rows: LoadRow[]
  loading: boolean
  demandLoading: boolean
}) {
  const unit = rows.find((r) => r.demand)?.demand?.unit ?? "kVA"
  const demandCell = (pick: (d: NonNullable<LoadRow["demand"]>) => number) =>
    function DemandCell({ row }: { row: { original: LoadRow } }) {
      const d = row.original.demand
      if (demandLoading) return <Skeleton className="ml-auto h-4 w-14" />
      return d ? (
        formatNumber(pick(d))
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    }
  const columns: ColumnDef<LoadRow, unknown>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Load",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: loadColor(row.index) }}
          />
          {formatDeviceName(row.original.name)}
        </span>
      ),
    },
    {
      id: "kwh",
      accessorKey: "kwh",
      header: "Consumption (kWh)",
      meta: { align: "right" },
      cell: ({ getValue }) => formatNumber(getValue() as number),
    },
    {
      id: "share",
      accessorKey: "shareOfLoads",
      header: "Share",
      meta: { align: "right" },
      cell: ({ getValue }) => `${formatNumber(getValue() as number, 1)}%`,
    },
    {
      id: "max",
      accessorFn: (r) => r.demand?.max ?? 0,
      header: `Max demand (${unit})`,
      meta: { align: "right" },
      cell: demandCell((d) => d.max),
    },
    {
      id: "avg",
      accessorFn: (r) => r.demand?.avg ?? 0,
      header: `Avg demand (${unit})`,
      meta: { align: "right" },
      cell: demandCell((d) => d.avg),
    },
    {
      id: "min",
      accessorFn: (r) => r.demand?.min ?? 0,
      header: `Min demand (${unit})`,
      meta: { align: "right" },
      cell: demandCell((d) => d.min),
    },
    {
      id: "hours",
      accessorKey: "runtimeHours",
      header: "Running time",
      meta: { align: "right" },
      cell: ({ getValue }) => formatHours(getValue() as number),
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loads</CardTitle>
        <CardDescription>
          Consumption, demand and running time per load meter
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={loading}
          pageSize={false}
          className="overflow-x-auto"
        />
      </CardContent>
    </Card>
  )
}
