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
import {
  CardError,
  InfoHint,
  Stat,
  statCardClass,
  ValueSkeleton,
} from "@/components/shared/card-parts"
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
import { getEnergyConsumption } from "@/lib/api/parameters"
import { downloadCsv, fileSlug } from "@/lib/export"
import { formatDeviceName, formatNumber } from "@/lib/format"
import {
  energyMeterTotals,
  energySeries,
  isStacked,
  type EnergyRow,
} from "@/lib/parameters/energy-consumption"
import { GRANULARITY, periodLabel } from "@/lib/period"

export function EnergyConsumptionView() {
  const f = useParameterFilters()
  const granularity = GRANULARITY[f.period.kind]
  const query = useQuery({
    queryKey: ["parameters", "energy-consumption", ...f.keyBase],
    queryFn: ({ signal }) => getEnergyConsumption(f.branchId, f.period, signal),
  })

  const series = energySeries(query.data, f.selectedDeviceIds, f.period)
  const meters = energyMeterTotals(query.data, f.selectedDeviceIds)
  const config = deviceChartConfig(series.devices)
  const stacked = isStacked(f.selectedDeviceIds.length)
  const showTotal = series.devices.length > 1

  const columns: ColumnDef<EnergyRow, unknown>[] = [
    {
      id: "time",
      accessorKey: "ts",
      header: "Date/Time",
      cell: ({ row }) => row.original.rowLabel,
    },
    ...series.devices.map((device): ColumnDef<EnergyRow, unknown> => ({
      id: device.key,
      accessorFn: (row) => row[device.key] as number,
      header: `${formatDeviceName(device.name)} (kWh)`,
      cell: ({ getValue }) => formatNumber(getValue() as number),
      meta: { align: "right" },
    })),
    ...(showTotal
      ? [
          {
            id: "total",
            accessorFn: (row: EnergyRow) => row.total as number,
            header: "Total (kWh)",
            cell: ({ getValue }) => (
              <span className="font-medium">
                {formatNumber(getValue() as number)}
              </span>
            ),
            meta: { align: "right" },
          } satisfies ColumnDef<EnergyRow, unknown>,
        ]
      : []),
  ]

  const sums = Object.fromEntries(
    [...series.devices.map((d) => d.key), "total"].map((key) => [
      key,
      series.tableRows.reduce(
        (acc, row) => acc + ((row[key] as number) ?? 0),
        0
      ),
    ])
  )
  const footer = {
    time: "Total",
    ...Object.fromEntries(
      Object.entries(sums).map(([key, value]) => [key, formatNumber(value)])
    ),
  }

  const exportCsv = () =>
    downloadCsv<Record<string, string | number>>(
      fileSlug("energy-consumption", ...f.fileTag),
      [
        { key: "time", label: "Date/Time" },
        ...series.devices.map((d) => ({
          key: d.key,
          label: `${formatDeviceName(d.name)} (kWh)`,
        })),
        ...(showTotal ? [{ key: "total", label: "Total (kWh)" }] : []),
      ],
      series.tableRows.map((row) => ({
        time: row.rowLabel,
        ...Object.fromEntries(
          [...series.devices.map((d) => d.key), "total"].map((key) => [
            key,
            Math.round((row[key] as number) * 100) / 100,
          ])
        ),
      }))
    )

  return (
    <ParametersPage
      title="Energy consumption"
      description={`Energy per ${GRANULARITY_WORD[granularity]} for each device · ${periodLabel(f.period)}`}
    >
      <Card>
        <CardHeader>
          <CardTitle>Energy by device</CardTitle>
          <CardDescription>
            kWh per {GRANULARITY_WORD[granularity]}
          </CardDescription>
          <CardAction>
            <InfoHint>
              Energy each meter recorded per {GRANULARITY_WORD[granularity]}.
              Bars are stacked when all devices or more than three are shown,
              and side by side when you pick one to three devices to compare.
            </InfoHint>
          </CardAction>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Skeleton className="h-72 w-full" />
          ) : query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : series.devices.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No devices in the current selection.
            </p>
          ) : (
            <ChartContainer config={config} className="aspect-auto h-72 w-full">
              <BarChart data={series.rows} margin={{ left: 4, right: 4 }}>
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
                  content={<UnitTooltip config={config} unit="kWh" />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {series.devices.map((device, index) => (
                  <Bar
                    key={device.key}
                    dataKey={device.key}
                    stackId={stacked ? "energy" : undefined}
                    fill={`var(--color-${device.key})`}
                    radius={
                      !stacked || index === series.devices.length - 1
                        ? [4, 4, 0, 0]
                        : 0
                    }
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            [
              "previous",
              "Previous",
              "Sum of the meter readings at the start of the period.",
            ],
            [
              "current",
              "Current",
              "Sum of the meter readings at the end of the period.",
            ],
            [
              "usage",
              "Usage",
              "Energy used in the period: current minus previous reading.",
            ],
          ] as const
        ).map(([key, label, hint]) => (
          <Card key={key} className={statCardClass}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardAction>
                <InfoHint>{hint}</InfoHint>
              </CardAction>
            </CardHeader>
            <CardContent>
              {query.isPending ? (
                <ValueSkeleton />
              ) : query.isError ? (
                <CardError onRetry={() => query.refetch()} />
              ) : (
                <Stat value={formatNumber(meters[key])} unit="kWh" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raw logs</CardTitle>
          <CardDescription>
            kWh per {GRANULARITY_WORD[granularity]} for each device
          </CardDescription>
          <CardAction>
            <CsvButton
              onClick={exportCsv}
              disabled={!series.tableRows.length}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={series.tableRows}
              isLoading={query.isPending}
              footer={footer}
            />
          )}
        </CardContent>
      </Card>
    </ParametersPage>
  )
}
