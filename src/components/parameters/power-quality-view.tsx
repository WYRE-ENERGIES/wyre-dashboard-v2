"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  GRANULARITY_WORD,
  UnitTooltip,
} from "@/components/parameters/chart-parts"
import { CsvButton } from "@/components/parameters/csv-button"
import { ParametersPage } from "@/components/parameters/parameters-page"
import { useParameterFilters } from "@/components/parameters/use-parameters"
import { CardError } from "@/components/shared/card-parts"
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
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PowerQualityDevice } from "@/lib/api/parameters-types"
import { getPowerQuality } from "@/lib/api/parameters"
import { downloadCsv, fileSlug } from "@/lib/export"
import { formatDeviceName, formatNumber } from "@/lib/format"
import {
  MEASURES,
  PHASES,
  qualitySeries,
  type MeasureKey,
  type QualityRow,
} from "@/lib/parameters/power-quality"
import {
  branchDevices,
  filterParamDevices,
  withUnit,
} from "@/lib/parameters/series"
import { GRANULARITY, periodLabel, type Period } from "@/lib/period"

// Phases stay in the purple family; lightness plus dash pattern tell them apart.
const PHASE_STYLE: Record<string, { color: string; dash?: string }> = {
  l1: { color: "var(--chart-1)" },
  l2: { color: "var(--chart-2)" },
  l3: { color: "var(--chart-5)", dash: "6 3" },
  neutral: { color: "var(--muted-foreground)", dash: "2 4" },
}

export function PowerQualityView() {
  const f = useParameterFilters()
  const [measure, setMeasure] = React.useState<MeasureKey>("current")
  const query = useQuery({
    queryKey: ["parameters", "power-quality", ...f.keyBase],
    queryFn: ({ signal }) => getPowerQuality(f.branchId, f.period, signal),
  })
  const devices = filterParamDevices(
    branchDevices(query.data),
    f.selectedDeviceIds
  )
  const granularity = GRANULARITY[f.period.kind]

  return (
    <ParametersPage
      title="Power quality"
      description={`Per-phase readings, averaged per ${GRANULARITY_WORD[granularity]} · ${periodLabel(f.period)}`}
      actions={
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[measure]}
          onValueChange={(value) =>
            value[0] && setMeasure(value[0] as MeasureKey)
          }
          aria-label="Measure"
        >
          {MEASURES.map((m) => (
            <ToggleGroupItem key={m.key} value={m.key} aria-label={m.label}>
              {/* "Active power" → "Active" on phones, so the four fit in one row. */}
              {m.label.replace(/ power$/, "")}
              {m.label.endsWith(" power") && (
                <span className="hidden sm:inline">&nbsp;power</span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {query.isPending ? (
        <DeviceSkeleton />
      ) : query.isError ? (
        <Card>
          <CardContent>
            <CardError onRetry={() => query.refetch()} />
          </CardContent>
        </Card>
      ) : devices.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No devices in the current selection.
        </p>
      ) : (
        devices.map((device, index) => (
          <DeviceSection
            key={device.device_id ?? index}
            device={device}
            measure={measure}
            period={f.period}
            fileTag={f.fileTag}
          />
        ))
      )}
    </ParametersPage>
  )
}

function DeviceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  )
}

function DeviceSection({
  device,
  measure,
  period,
  fileTag,
}: {
  device: PowerQualityDevice
  measure: MeasureKey
  period: Period
  fileTag: string[]
}) {
  const granularity = GRANULARITY[period.kind]
  const s = qualitySeries(device, measure, period)
  const config: ChartConfig = Object.fromEntries(
    PHASES.map((p) => [
      p.key,
      { label: p.label, color: PHASE_STYLE[p.key].color },
    ])
  )
  const name = formatDeviceName(device.name)
  const num = (value: unknown, digits = 2) =>
    value === null || value === undefined
      ? "–"
      : formatNumber(value as number, digits)

  const columns: ColumnDef<QualityRow, unknown>[] = [
    {
      id: "time",
      accessorKey: "ts",
      header: "Date/Time",
      cell: ({ row }) => row.original.rowLabel,
    },
    ...PHASES.filter((p) => p.key !== "neutral" || s.showNeutral).map(
      (p): ColumnDef<QualityRow, unknown> => ({
        id: p.key,
        accessorKey: p.key,
        header: withUnit(p.label, s.unit),
        cell: ({ getValue }) => num(getValue()),
        meta: { align: "right" },
      })
    ),
    {
      id: "frequency",
      accessorKey: "frequency",
      header: withUnit("Frequency", s.frequencyUnit),
      cell: ({ getValue }) => num(getValue()),
      meta: { align: "right" },
    },
    {
      id: "powerFactor",
      accessorKey: "powerFactor",
      header: "Power factor",
      cell: ({ getValue }) => num(getValue(), 3),
      meta: { align: "right" },
    },
  ]

  const exportCsv = () =>
    downloadCsv(
      fileSlug(device.name, "power-quality", s.measureLabel, ...fileTag),
      [
        { key: "time", label: "Date/Time" },
        { key: "l1", label: withUnit("Line 1", s.unit) },
        { key: "l2", label: withUnit("Line 2", s.unit) },
        { key: "l3", label: withUnit("Line 3", s.unit) },
        { key: "neutral", label: withUnit("Neutral", s.unit) },
        { key: "frequency", label: withUnit("Frequency", s.frequencyUnit) },
        { key: "powerFactor", label: "Power factor" },
      ],
      s.tableRows.map((r) => ({
        time: r.rowLabel,
        l1: r.l1,
        l2: r.l2,
        l3: r.l3,
        neutral: r.neutral,
        frequency: r.frequency,
        powerFactor: r.powerFactor,
      }))
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          {s.measureLabel} per phase · {s.unit || "no unit"}
        </CardDescription>
        <CardAction>
          <CsvButton onClick={exportCsv} disabled={!s.tableRows.length} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {s.tableRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No readings from {name} in this period.
          </p>
        ) : (
          <>
            {s.lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No {s.measureLabel.toLowerCase()} readings from {name} in this
                period.
              </p>
            ) : (
              <ChartContainer
                config={config}
                className="aspect-auto h-64 w-full"
              >
                <LineChart data={s.rows} margin={{ left: 4, right: 4, top: 4 }}>
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
                    content={<UnitTooltip config={config} unit={s.unit} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {s.lines.map((p) => (
                    <Line
                      key={p.key}
                      dataKey={p.key}
                      type="monotone"
                      stroke={`var(--color-${p.key})`}
                      strokeWidth={2}
                      strokeDasharray={PHASE_STYLE[p.key].dash}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
            <DataTable columns={columns} data={s.tableRows} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
