"use client"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  deviceChartConfig,
  GRANULARITY_WORD,
  UnitTooltip,
} from "@/components/parameters/chart-parts"
import { CsvButton } from "@/components/parameters/csv-button"
import { ParametersPage } from "@/components/parameters/parameters-page"
import { useParameterFilters } from "@/components/parameters/use-parameters"
import { CardError, InfoHint } from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { getPowerDemand } from "@/lib/api/parameters"
import { downloadCsv, fileSlug } from "@/lib/export"
import { formatDeviceName, formatNumber } from "@/lib/format"
import { demandData, type DemandRow } from "@/lib/parameters/power-demand"
import { withUnit } from "@/lib/parameters/series"
import { GRANULARITY, periodLabel } from "@/lib/period"

export function PowerDemandView() {
  const f = useParameterFilters()
  const granularity = GRANULARITY[f.period.kind]
  const query = useQuery({
    queryKey: ["parameters", "power-demand", ...f.keyBase],
    queryFn: ({ signal }) => getPowerDemand(f.branchId, f.period, signal),
  })

  const d = demandData(query.data, f.selectedDeviceIds, f.period)
  const config = deviceChartConfig(d.devices)
  // Unit in the headers when every device reports the same one, else per row.
  const headerUnit = d.unit ?? ""
  const unitLabel = d.unit ?? d.units.join(" / ")
  const num = (value: unknown) =>
    value === null || value === undefined ? "–" : formatNumber(value as number)

  const columns: ColumnDef<DemandRow, unknown>[] = [
    {
      id: "time",
      accessorKey: "ts",
      header: "Date/Time",
      cell: ({ row }) => row.original.rowLabel,
    },
    {
      id: "source",
      accessorKey: "source",
      header: "Source",
      cell: ({ getValue }) => formatDeviceName(getValue() as string),
    },
    ...(["min", "max", "avg"] as const).map(
      (key): ColumnDef<DemandRow, unknown> => ({
        id: key,
        accessorKey: key,
        header: withUnit(
          { min: "Minimum", max: "Maximum", avg: "Average" }[key],
          headerUnit
        ),
        cell: ({ getValue }) => num(getValue()),
        meta: { align: "right" },
      })
    ),
    ...(d.unit
      ? []
      : [
          {
            id: "unit",
            accessorKey: "unit",
            header: "Unit",
          } satisfies ColumnDef<DemandRow, unknown>,
        ]),
  ]

  const exportCsv = () =>
    downloadCsv<Record<string, string | number | null>>(
      fileSlug("power-demand", ...f.fileTag),
      [
        { key: "time", label: "Date/Time" },
        { key: "source", label: "Source" },
        { key: "min", label: withUnit("Minimum", headerUnit) },
        { key: "max", label: withUnit("Maximum", headerUnit) },
        { key: "avg", label: withUnit("Average", headerUnit) },
        ...(d.unit ? [] : [{ key: "unit", label: "Unit" }]),
      ],
      d.tableRows.map((r) => ({
        time: r.rowLabel,
        source: formatDeviceName(r.source),
        min: r.min,
        max: r.max,
        avg: r.avg,
        unit: r.unit,
      }))
    )

  return (
    <ParametersPage
      title="Power demand"
      description={`Demand per ${GRANULARITY_WORD[granularity]} for each source · ${periodLabel(f.period)}`}
    >
      <Card>
        <CardHeader>
          <CardTitle>Demand by source</CardTitle>
          <CardDescription>
            {query.isSuccess && d.devices.length ? unitLabel : " "} per{" "}
            {GRANULARITY_WORD[granularity]}
          </CardDescription>
          <CardAction>
            <InfoHint>
              Power drawn from each source per {GRANULARITY_WORD[granularity]},
              stacked so the top of each bar is the building&apos;s total
              demand.
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Skeleton className="h-72 w-full" />
          ) : query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : d.devices.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No devices in the current selection.
            </p>
          ) : (
            <ChartContainer config={config} className="aspect-auto h-72 w-full">
              <BarChart data={d.chartRows} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={granularity === "hourly" ? 16 : 4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => formatNumber(value, 0)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<UnitTooltip config={config} unit={headerUnit} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {d.devices.map((device, index) => (
                  <Bar
                    key={device.key}
                    dataKey={device.key}
                    stackId="demand"
                    fill={`var(--color-${device.key})`}
                    radius={index === d.devices.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw logs</CardTitle>
          <CardDescription>
            Minimum, maximum and average demand per source
          </CardDescription>
          <CardAction>
            <CsvButton onClick={exportCsv} disabled={!d.tableRows.length} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={d.tableRows}
              isLoading={query.isPending}
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>
    </ParametersPage>
  )
}
