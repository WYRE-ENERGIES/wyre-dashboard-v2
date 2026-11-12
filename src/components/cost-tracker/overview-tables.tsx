"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"

import { DailyEntryForm } from "@/components/cost-tracker/entry-forms"
import { EditDialog, RowActions } from "@/components/cost-tracker/row-actions"
import {
  kwh,
  litres,
  naira,
  percent,
  SectionCard,
} from "@/components/cost-tracker/shared"
import {
  COST_TRACKER_KEY,
  useCostMutation,
} from "@/components/cost-tracker/use-cost-tracker"
import { useClaims } from "@/components/session-provider"
import { CardError } from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  deleteDieselEntry,
  getFuelConsumption,
  updateDieselEntry,
} from "@/lib/api/cost-tracker"
import type {
  DieselOverviewRow,
  FuelConsumptionDay,
  UtilityOverviewRow,
} from "@/lib/api/cost-tracker-types"
import {
  canEditRecord,
  dieselOverviewTotals,
  editMinutesLeft,
  entryDateLabel,
  num,
  parseDate,
  utilityOverviewTotals,
  EDIT_WINDOW_MINUTES,
} from "@/lib/cost-tracker/rules"
import { formatDeviceName, formatHours } from "@/lib/format"
import { isOperator } from "@/lib/gating"

type DieselRow = DieselOverviewRow & { monthDate: Date }
type UtilityRow = UtilityOverviewRow & { monthDate: Date }

const right = { align: "right" } as const
const numberCell =
  <T,>(
    key: keyof T,
    fmt: (n: number) => string
  ): ColumnDef<T, unknown>["cell"] =>
  ({ row }) =>
    fmt(num(row.original[key] as never))

/**
 * Diesel Overview: inputted vs forecasted usage and cost per month. A month
 * opens its daily entries (old DieselOverviewCostTrackerTable).
 */
export function DieselOverviewCard({
  rows,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  rows: DieselRow[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const [month, setMonth] = React.useState<Date | null>(null)
  const columns = React.useMemo<ColumnDef<DieselRow, unknown>[]>(
    () => [
      {
        id: "month",
        header: "Month",
        accessorFn: (r) => r.monthDate.getTime(),
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 font-medium"
            onClick={() => setMonth(row.original.monthDate)}
          >
            {format(row.original.monthDate, "MMM yyyy")}
          </Button>
        ),
      },
      {
        id: "inputted_usage",
        header: "Inputted usage (L)",
        meta: right,
        cell: numberCell("inputted_usage", litres),
      },
      {
        id: "forecasted_usage",
        header: "Forecasted usage (L)",
        meta: right,
        cell: numberCell("forecasted_usage", litres),
      },
      {
        id: "inputted_cost",
        header: "Inputted cost (₦)",
        meta: right,
        cell: numberCell("inputted_cost", naira),
      },
      {
        id: "forecasted_cost",
        header: "Forecasted cost (₦)",
        meta: right,
        cell: numberCell("forecasted_cost", naira),
      },
      {
        id: "diesel_difference",
        header: "Diesel difference (L)",
        meta: right,
        cell: numberCell("diesel_difference", litres),
      },
      {
        id: "cost_difference",
        header: "Cost difference (₦)",
        meta: right,
        cell: numberCell("cost_difference", naira),
      },
      {
        id: "percentage_usage",
        header: "Difference (%)",
        meta: right,
        cell: numberCell("percentage_usage", percent),
      },
    ],
    []
  )
  const t = dieselOverviewTotals(rows)
  return (
    <SectionCard
      title="Diesel overview"
      description={`${periodText} · select a month to see its daily entries`}
      hint="Tracks and verifies monthly diesel use: litres entered by your team against Wyre's forecast from generator energy."
      error={isError}
      onRetry={onRetry}
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyText="No diesel overview for this period."
        footer={
          rows.length > 1
            ? {
                month: "Total",
                inputted_usage: litres(t.inputted_usage),
                forecasted_usage: litres(t.forecasted_usage),
                inputted_cost: naira(t.inputted_cost),
                forecasted_cost: naira(t.forecasted_cost),
                diesel_difference: litres(t.diesel_difference),
                cost_difference: naira(t.cost_difference),
                percentage_usage: `${percent(t.percentage_usage)} avg`,
              }
            : undefined
        }
      />
      <DieselMonthDialog month={month} onClose={() => setMonth(null)} />
    </SectionCard>
  )
}

/** Utility or IPP overview: purchased vs consumed energy per month. */
export function UtilityOverviewCard({
  title,
  hint,
  rows,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  title: string
  hint: string
  rows: UtilityRow[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const columns = React.useMemo<ColumnDef<UtilityRow, unknown>[]>(
    () => [
      {
        id: "month",
        header: "Month",
        accessorFn: (r) => r.monthDate.getTime(),
        cell: ({ row }) => (
          <span className="font-medium">
            {format(row.original.monthDate, "MMM yyyy")}
          </span>
        ),
      },
      {
        id: "purchased_kwh",
        header: "Purchased (kWh)",
        meta: right,
        cell: numberCell("purchased_kwh", kwh),
      },
      {
        id: "energy_consumed_kwh",
        header: "Consumed (kWh)",
        meta: right,
        cell: numberCell("energy_consumed_kwh", kwh),
      },
      {
        id: "purchased_naira",
        header: "Purchased (₦)",
        meta: right,
        cell: numberCell("purchased_naira", naira),
      },
      {
        id: "energy_consumed_naira",
        header: "Consumed (₦)",
        meta: right,
        cell: numberCell("energy_consumed_naira", naira),
      },
      {
        id: "difference_kwh",
        header: "Difference (kWh)",
        meta: right,
        cell: numberCell("difference_kwh", kwh),
      },
      {
        id: "difference_naira",
        header: "Difference (₦)",
        meta: right,
        cell: numberCell("difference_naira", naira),
      },
      {
        id: "percentage",
        header: "Difference (%)",
        meta: right,
        cell: numberCell("percentage", percent),
      },
    ],
    []
  )
  const t = utilityOverviewTotals(rows)
  return (
    <SectionCard
      title={title}
      description={periodText}
      hint={hint}
      error={isError}
      onRetry={onRetry}
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyText={`No ${title.toLowerCase()} for this period.`}
        footer={
          rows.length > 1
            ? {
                month: "Total",
                purchased_kwh: kwh(t.purchased_kwh),
                energy_consumed_kwh: kwh(t.energy_consumed_kwh),
                purchased_naira: naira(t.purchased_naira),
                energy_consumed_naira: naira(t.energy_consumed_naira),
                difference_kwh: kwh(t.difference_kwh),
                difference_naira: naira(t.difference_naira),
                percentage: `${percent(t.percentage)} avg`,
              }
            : undefined
        }
      />
    </SectionCard>
  )
}

const entryId = (d: FuelConsumptionDay) => d.fuel_consumption_id ?? d.id

/**
 * A month's daily diesel entries (old month modal). Production calls the
 * endpoint with the branch id (07 §6); operators can edit or delete entries.
 */
function DieselMonthDialog({
  month,
  onClose,
}: {
  month: Date | null
  onClose: () => void
}) {
  const claims = useClaims()
  const branchId = claims.branch_id
  const operator = isOperator(claims)
  const year = month?.getFullYear() ?? 0
  const monthNumber = (month?.getMonth() ?? 0) + 1
  const query = useQuery({
    queryKey: [
      COST_TRACKER_KEY,
      "fuel-consumption",
      branchId,
      year,
      monthNumber,
    ],
    queryFn: ({ signal }) =>
      getFuelConsumption(branchId, year, monthNumber, signal),
    enabled: month !== null,
  })
  const [editing, setEditing] = React.useState<FuelConsumptionDay | null>(null)

  const update = useCostMutation(
    (v: { id: number; input: Parameters<typeof updateDieselEntry>[1] }) =>
      updateDieselEntry(v.id, v.input),
    {
      success: "Diesel entry updated",
      error: "Couldn't update the diesel entry",
    }
  )
  const { mutateAsync: remove } = useCostMutation(
    (id: number) => deleteDieselEntry(id),
    {
      success: "Diesel entry deleted",
      error: "Couldn't delete the diesel entry",
    }
  )

  const rows = React.useMemo(
    () =>
      [...(query.data?.data ?? [])].sort(
        (a, b) =>
          (parseDate(a.date)?.getTime() ?? 0) -
          (parseDate(b.date)?.getTime() ?? 0)
      ),
    [query.data]
  )
  const showGenerator = rows.some((r) => r.generator_name)

  const columns = React.useMemo<
    ColumnDef<FuelConsumptionDay, unknown>[]
  >(() => {
    const cols: ColumnDef<FuelConsumptionDay, unknown>[] = [
      {
        id: "date",
        header: "Date",
        accessorFn: (r) => parseDate(r.date)?.getTime() ?? 0,
        cell: ({ row }) =>
          entryDateLabel(row.original.date, row.original.end_date),
      },
    ]
    if (showGenerator)
      cols.push({
        id: "generator",
        header: "Generator",
        cell: ({ row }) =>
          row.original.generator_name
            ? formatDeviceName(row.original.generator_name)
            : "—",
      })
    cols.push(
      {
        id: "quantity",
        header: "Quantity (L)",
        meta: right,
        accessorFn: (r) => num(r.quantity),
        cell: ({ row }) => litres(num(row.original.quantity)),
      },
      {
        id: "hours",
        header: "Hours",
        meta: right,
        accessorFn: (r) => num(r.hours_of_use),
        cell: ({ row }) => formatHours(num(row.original.hours_of_use)),
      }
    )
    if (operator)
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const id = entryId(row.original)
          if (id == null) return null
          // Entries with a record time follow the 30-minute rule; the drill-down
          // response may not include it, in which case the backend decides.
          const locked = row.original.record_time
            ? !canEditRecord(row.original.record_time)
            : false
          return (
            <RowActions
              label="diesel entry"
              onEdit={() => setEditing(row.original)}
              editDisabledReason={
                locked
                  ? `Locked: entries can be edited for ${EDIT_WINDOW_MINUTES} min after recording`
                  : undefined
              }
              onDelete={() => remove(id)}
            />
          )
        },
      })
    return cols
  }, [operator, showGenerator, remove])

  const total = rows.reduce((t, r) => t + num(r.quantity), 0)

  return (
    <>
      <Dialog open={month !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Diesel entries · {month ? format(month, "MMMM yyyy") : ""}
            </DialogTitle>
            <DialogDescription>
              {query.data?.branch_name ? `${query.data.branch_name} · ` : ""}
              {rows.length
                ? `${rows.length} entries, ${litres(total)} L in total`
                : "Daily diesel entries"}
            </DialogDescription>
          </DialogHeader>
          {query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={query.isPending}
              pageSize={8}
              emptyText="No diesel entries for this month."
            />
          )}
        </DialogContent>
      </Dialog>
      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit diesel entry"
        description={
          editing?.record_time
            ? `${editMinutesLeft(editing.record_time)} min left to edit this entry.`
            : "Update the daily diesel entry."
        }
      >
        {editing && (
          <DailyEntryForm
            submitLabel="Save changes"
            defaultValues={{
              start_date: parseDate(editing.date) ?? undefined,
              end_date:
                parseDate(editing.end_date ?? editing.date) ?? undefined,
              quantity: String(num(editing.quantity)),
              generator_id: editing.device_id
                ? String(editing.device_id)
                : undefined,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const id = entryId(editing)
              if (id == null) return
              await update.mutateAsync({
                id,
                input: { ...input, type: "Daily" },
              })
              setEditing(null)
            }}
          />
        )}
      </EditDialog>
    </>
  )
}
