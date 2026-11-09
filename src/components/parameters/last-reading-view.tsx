"use client"

import { useQuery } from "@tanstack/react-query"
import { format, isBefore } from "date-fns"
import { ClockIcon } from "lucide-react"

import { CsvButton } from "@/components/parameters/csv-button"
import { ParametersPage } from "@/components/parameters/parameters-page"
import { useParameterFilters } from "@/components/parameters/use-parameters"
import { CardError } from "@/components/shared/card-parts"
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
import { getLastReading, lastReadingAsOf } from "@/lib/api/parameters"
import type { LastReadingDevice } from "@/lib/api/parameters-types"
import { downloadCsv, fileSlug } from "@/lib/export"
import { formatDeviceName, formatNumber } from "@/lib/format"
import {
  includesNow,
  readingCsvRows,
  readingLabel,
  readingSections,
  readingTime,
  readingUnit,
  type ReadingSection,
} from "@/lib/parameters/last-reading"
import { branchDevices, filterParamDevices } from "@/lib/parameters/series"
import { periodStart } from "@/lib/period"

/**
 * Last Reading: the latest meter snapshot per device, as of the period's end
 * ("now" for the current period). The old page always asked for "now" with a
 * malformed date and ignored the date picker (inventory 03 §1).
 */
export function LastReadingView() {
  const f = useParameterFilters()
  const asOf = lastReadingAsOf(f.period)
  const isNow = includesNow(f.period)
  const query = useQuery({
    queryKey: ["parameters", "last-reading", ...f.keyBase],
    queryFn: ({ signal }) => getLastReading(f.branchId, f.period, signal),
    // The endpoint has been slow (2+ minutes live); don't triple the wait.
    retry: 1,
    staleTime: 60_000,
  })
  const devices = filterParamDevices(
    branchDevices(query.data),
    f.selectedDeviceIds
  )

  return (
    <ParametersPage
      title="Last reading"
      description={
        isNow
          ? "Latest meter snapshot for each device"
          : `Meter snapshot for each device as of ${format(asOf, "EEE d MMM yyyy, HH:mm")}`
      }
    >
      {query.isPending ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Fetching the latest readings. This can take a minute.
          </p>
          <ReadingSkeleton />
        </div>
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
          <DeviceReading
            key={device.device_id ?? index}
            device={device}
            periodStartAt={periodStart(f.period)}
            fileTag={f.fileTag}
          />
        ))
      )}
    </ParametersPage>
  )
}

function ReadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

function DeviceReading({
  device,
  periodStartAt,
  fileTag,
}: {
  device: LastReadingDevice
  periodStartAt: Date
  fileTag: string[]
}) {
  const name = formatDeviceName(device.name)
  const takenAt = readingTime(device.last_reading?.date)
  const sections = readingSections(device)

  const exportCsv = () =>
    downloadCsv(
      fileSlug(device.name, "last-reading", ...fileTag),
      [
        { key: "section", label: "Section" },
        { key: "measurement", label: "Measurement" },
        { key: "l1", label: "Line 1" },
        { key: "l2", label: "Line 2" },
        { key: "l3", label: "Line 3" },
        { key: "value", label: "Value" },
        { key: "unit", label: "Unit" },
      ],
      readingCsvRows(device)
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ClockIcon className="size-3.5" aria-hidden />
          {takenAt ? (
            <>
              Reading taken at {format(takenAt, "EEE d MMM yyyy, HH:mm")}
              {isBefore(takenAt, periodStartAt) && (
                <Badge variant="outline">Before this period</Badge>
              )}
            </>
          ) : (
            "No reading time reported"
          )}
        </CardDescription>
        <CardAction>
          <CsvButton onClick={exportCsv} disabled={!sections.length} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {sections.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reading from {name} yet.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <ReadingTable key={section.key} section={section} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReadingTable({ section }: { section: ReadingSection }) {
  const num = (value: number | null | undefined) => formatNumber(value, 2)
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-medium">{section.title}</h3>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Measurement</TableHead>
              {section.kind === "phase" ? (
                <>
                  <TableHead className="text-right">L1</TableHead>
                  <TableHead className="text-right">L2</TableHead>
                  <TableHead className="text-right">L3</TableHead>
                </>
              ) : (
                <TableHead className="text-right">Value</TableHead>
              )}
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.kind === "phase"
              ? section.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="whitespace-nowrap">
                      {readingLabel(row.name)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.l1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.l2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.l3)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {readingUnit(row.unit) || "–"}
                    </TableCell>
                  </TableRow>
                ))
              : section.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="whitespace-nowrap">
                      {readingLabel(row.name)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.value)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {readingUnit(row.unit) || "–"}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
