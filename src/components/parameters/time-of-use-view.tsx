"use client"

import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"

import { CsvButton } from "@/components/parameters/csv-button"
import { ParametersPage } from "@/components/parameters/parameters-page"
import { useParameterFilters } from "@/components/parameters/use-parameters"
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
import { getTimeOfUse } from "@/lib/api/parameters"
import type { TimeOfUseBranch } from "@/lib/api/parameters-types"
import { downloadCsv, fileSlug } from "@/lib/export"
import {
  formatDeviceName,
  formatHours,
  formatNumber,
  formatPercent,
} from "@/lib/format"
import { parseApiDate } from "@/lib/parameters/series"
import {
  orderedBranches,
  timeOfUseColumns,
  usageHours,
  type TouColumn,
} from "@/lib/parameters/time-of-use"
import { periodLabel, periodShortLabel, serializePeriod } from "@/lib/period"
import { cn } from "@/lib/utils"

type LogRow = Record<string, string | number | null>

/**
 * Time of Use: hours each source ran, per branch, plus the raw on/off log.
 * Like the old page it lists every branch of the organisation (signed-in
 * branch first). The device filter applies to the signed-in branch; while a
 * subset is selected only that branch is shown, since the selection names
 * its devices.
 */
export function TimeOfUseView() {
  const f = useParameterFilters()
  const { view, date } = serializePeriod(f.period)
  const query = useQuery({
    // Keyed by user: the endpoint returns the whole organisation.
    queryKey: [
      "parameters",
      "time-of-use",
      f.claims.id,
      f.branchId,
      view,
      date,
    ],
    queryFn: ({ signal }) => getTimeOfUse(f.claims.id, f.period, signal),
  })
  const { current, others } = orderedBranches(
    query.data,
    f.branchId,
    f.branchName
  )
  const filtered = f.selectedNames !== null

  return (
    <ParametersPage
      title="Time of use"
      description={`Hours each source ran · ${periodLabel(f.period)}`}
    >
      {query.isPending ? (
        <BranchSkeleton />
      ) : query.isError ? (
        <Card>
          <CardContent>
            <CardError onRetry={() => query.refetch()} />
          </CardContent>
        </Card>
      ) : !current && others.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No branches returned for this period.
        </p>
      ) : (
        <>
          {current && (
            <BranchSection
              branch={current}
              isCurrent
              onlyDevices={f.selectedNames}
              periodTag={periodShortLabel(f.period)}
            />
          )}
          {filtered
            ? others.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {others.length} other{" "}
                  {others.length === 1 ? "branch is" : "branches are"} hidden
                  while a device filter is on. Choose “All devices” to see them.
                </p>
              )
            : others.map((branch, index) => (
                <BranchSection
                  key={branch.branch_id ?? branch.id ?? index}
                  branch={branch}
                  onlyDevices={null}
                  periodTag={periodShortLabel(f.period)}
                />
              ))}
        </>
      )}
    </ParametersPage>
  )
}

function BranchSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  )
}

function statusText(value: unknown) {
  if (value === "ON") return "On"
  if (value === "OFF") return "Off"
  if (value === null || value === undefined || value === "" || value === "-")
    return "–"
  return String(value)
}

function cellText(column: TouColumn, value: unknown) {
  if (column.kind === "datetime") {
    const d = parseApiDate(typeof value === "string" ? value : null)
    return d ? format(d, "d MMM yyyy, HH:mm") : statusText(value)
  }
  if (column.kind === "hours" || column.kind === "cumulative") {
    return typeof value === "number" ? formatNumber(value) : statusText(value)
  }
  if (column.kind === "status") return statusText(value)
  return typeof value === "number" ? formatNumber(value) : statusText(value)
}

function BranchSection({
  branch,
  isCurrent = false,
  onlyDevices,
  periodTag,
}: {
  branch: TimeOfUseBranch
  isCurrent?: boolean
  onlyDevices: string[] | null
  periodTag: string
}) {
  const hours = usageHours(branch).filter(
    (d) => !onlyDevices || onlyDevices.includes(d.name)
  )
  const totalHours = hours.reduce((acc, d) => acc + (d.hours ?? 0), 0)
  const touColumns = timeOfUseColumns(branch, onlyDevices)
  const rows: LogRow[] = branch.time_of_use_table?.values ?? []

  const columns: ColumnDef<LogRow, unknown>[] = touColumns.map((column) => ({
    id: column.key,
    accessorFn: (row) => row[column.key],
    header:
      column.kind === "hours" || column.kind === "cumulative"
        ? `${column.label} (h)`
        : column.label,
    cell: ({ getValue }) => {
      const value = getValue()
      if (column.kind === "status") {
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              value !== "ON" && "text-muted-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                value === "ON" ? "bg-highlight" : "bg-muted-foreground/40"
              )}
            />
            {statusText(value)}
          </span>
        )
      }
      return cellText(column, value)
    },
    meta:
      column.kind === "hours" || column.kind === "cumulative"
        ? { align: "right" }
        : undefined,
  }))

  const exportCsv = () =>
    downloadCsv(
      fileSlug(branch.name, "time-of-use", periodTag),
      touColumns.map((c) => ({
        key: c.key,
        label:
          c.kind === "hours" || c.kind === "cumulative"
            ? `${c.label} (h)`
            : c.label,
      })),
      rows.map((row) =>
        Object.fromEntries(
          touColumns.map((c) => {
            const value = row[c.key]
            if (c.kind === "datetime") {
              const d = parseApiDate(typeof value === "string" ? value : null)
              return [c.key, d ? format(d, "yyyy-MM-dd HH:mm") : (value ?? "")]
            }
            return [c.key, value ?? ""]
          })
        )
      )
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {branch.name}
          {isCurrent && <Badge variant="secondary">Current branch</Badge>}
        </CardTitle>
        <CardDescription>
          {formatHours(totalHours)} of running time across {hours.length}{" "}
          {hours.length === 1 ? "source" : "sources"}
        </CardDescription>
        <CardAction>
          <CsvButton onClick={exportCsv} disabled={!rows.length} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hours.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No usage hours for this branch in this period.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {hours.map((device) => (
              <Card key={device.name} size="sm" className={statCardClass}>
                <CardHeader>
                  <CardDescription>
                    {formatDeviceName(device.name)}
                  </CardDescription>
                  <CardAction>
                    <InfoHint>
                      Hours {formatDeviceName(device.name)} was running in the
                      period
                      {totalHours
                        ? `, ${formatPercent(device.hours ?? 0, totalHours)} of this branch's running time`
                        : ""}
                      .
                    </InfoHint>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Stat
                    value={formatHours(device.hours)}
                    className="text-lg sm:text-2xl"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Raw logs</h3>
          <DataTable
            columns={columns}
            data={rows}
            emptyText="No raw logs for this period."
          />
        </div>
      </CardContent>
    </Card>
  )
}
