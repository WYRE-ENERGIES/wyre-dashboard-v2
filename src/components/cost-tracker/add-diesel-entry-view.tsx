"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { endOfMonth, format, isWithinInterval } from "date-fns"
import { ArrowLeftIcon, LockIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DailyEntryForm,
  MonthlyEntryForm,
} from "@/components/cost-tracker/entry-forms"
import { EditDialog, NotAllowed } from "@/components/cost-tracker/row-actions"
import {
  costPeriodLabel,
  LinkButton,
  litres,
  SectionCard,
} from "@/components/cost-tracker/shared"
import {
  useCostMutation,
  useDieselEntries,
} from "@/components/cost-tracker/use-cost-tracker"
import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  addDailyDieselEntry,
  addMonthlyDieselEntry,
  updateDieselEntry,
} from "@/lib/api/cost-tracker"
import type {
  DailyDieselEntry,
  DailyEntryInput,
  MonthlyDieselEntry,
  MonthlyEntryInput,
} from "@/lib/api/cost-tracker-types"
import {
  canEditRecord,
  EDIT_WINDOW_MINUTES,
  editMinutesLeft,
  entryDateLabel,
  monthlyEntryMonth,
  num,
  parseDate,
  periodMonthRange,
} from "@/lib/cost-tracker/rules"
import { formatDeviceName } from "@/lib/format"
import { isOperator } from "@/lib/gating"

const right = { align: "right" } as const

/** Re-renders every 30 s so Edit buttons lock when their window closes. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Add Diesel Entry (old mainAppPages/AddDieselEntry.js): record diesel
 * consumption daily per generator or as a monthly total, and fix recent
 * entries within 30 minutes. Operators only. The entry lists follow the
 * global period.
 */
export function AddDieselEntryView() {
  const claims = useClaims()
  return (
    <>
      <PageHeader
        title="Add diesel entry"
        description="Record the diesel your generators used."
        actions={
          <LinkButton href="/cost-tracker" variant="ghost">
            <ArrowLeftIcon />
            Cost Tracker
          </LinkButton>
        }
      />
      {isOperator(claims) ? (
        <DieselEntryTabs />
      ) : (
        <NotAllowed what="add diesel entries" />
      )}
    </>
  )
}

function EditWindowButton({
  recordTime,
  now,
  onEdit,
}: {
  recordTime?: string | null
  now: Date
  onEdit: () => void
}) {
  if (canEditRecord(recordTime, now))
    return (
      <Button variant="outline" size="xs" onClick={onEdit}>
        <PencilIcon />
        Edit · {editMinutesLeft(recordTime, now)} min
      </Button>
    )
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button variant="ghost" size="xs" disabled>
          <LockIcon />
          Locked
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Entries can be edited for {EDIT_WINDOW_MINUTES} minutes after
        they&apos;re recorded.
      </TooltipContent>
    </Tooltip>
  )
}

function DieselEntryTabs() {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const periodText = costPeriodLabel(period)
  const entries = useDieselEntries()
  const now = useNow()
  const [editingDaily, setEditingDaily] =
    React.useState<DailyDieselEntry | null>(null)
  const [editingMonthly, setEditingMonthly] =
    React.useState<MonthlyDieselEntry | null>(null)

  const addDaily = useCostMutation(
    (input: DailyEntryInput) => addDailyDieselEntry(branchId, input),
    {
      success: "Daily diesel entry added",
      error: "Couldn't add the daily diesel entry",
    }
  )
  const addMonthly = useCostMutation(
    (input: MonthlyEntryInput) => addMonthlyDieselEntry(branchId, input),
    {
      success: "Monthly diesel entry added",
      error: "Couldn't add the monthly diesel entry",
    }
  )
  const update = useCostMutation(
    (v: { id: number; input: Parameters<typeof updateDieselEntry>[1] }) =>
      updateDieselEntry(v.id, v.input),
    {
      success: "Diesel entry updated",
      error: "Couldn't update the diesel entry",
    }
  )

  const range = React.useMemo(() => periodMonthRange(period), [period])
  // Newest first (the old sort used a field the rows don't have).
  const dailyRows = React.useMemo(
    () =>
      (entries.daily.data?.data ?? [])
        .filter((e) => {
          const d = parseDate(e.start_date)
          return d && isWithinInterval(d, range)
        })
        .sort(
          (a, b) =>
            b.start_date.localeCompare(a.start_date) ||
            (b.record_time ?? "").localeCompare(a.record_time ?? "")
        ),
    [entries.daily.data, range]
  )
  const monthlyRows = React.useMemo(
    () =>
      (entries.monthly.data?.data ?? [])
        .map((e) => ({ ...e, monthDate: monthlyEntryMonth(e) }))
        .filter(
          (e): e is MonthlyDieselEntry & { monthDate: Date } =>
            !!e.monthDate && isWithinInterval(e.monthDate, range)
        )
        .sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime()),
    [entries.monthly.data, range]
  )

  const dailyColumns = React.useMemo<ColumnDef<DailyDieselEntry, unknown>[]>(
    () => [
      {
        id: "date",
        header: "Date",
        accessorFn: (r) => r.start_date,
        cell: ({ row }) => {
          const { start_date, end_date } = row.original
          const isRange = end_date && end_date !== start_date
          return (
            <span className={isRange ? "font-medium text-primary" : undefined}>
              {entryDateLabel(start_date, end_date)}
            </span>
          )
        },
      },
      {
        id: "quantity",
        header: "Quantity (L)",
        meta: right,
        accessorFn: (r) => num(r.quantity),
        cell: ({ getValue }) => litres(getValue() as number),
      },
      {
        id: "generator",
        header: "Generator",
        accessorFn: (r) => r.generator_name ?? "",
        cell: ({ row }) =>
          row.original.generator_name
            ? formatDeviceName(row.original.generator_name)
            : "—",
      },
      {
        id: "action",
        header: () => <span className="sr-only">Action</span>,
        enableSorting: false,
        meta: right,
        cell: ({ row }) => (
          <EditWindowButton
            recordTime={row.original.record_time}
            now={now}
            onEdit={() => setEditingDaily(row.original)}
          />
        ),
      },
    ],
    [now]
  )
  const monthlyColumns = React.useMemo<
    ColumnDef<MonthlyDieselEntry & { monthDate: Date }, unknown>[]
  >(
    () => [
      {
        id: "month",
        header: "Month",
        accessorFn: (r) => r.monthDate.getTime(),
        cell: ({ row }) => format(row.original.monthDate, "MMMM yyyy"),
      },
      {
        id: "quantity",
        header: "Quantity (L)",
        meta: right,
        accessorFn: (r) => num(r.quantity),
        cell: ({ getValue }) => litres(getValue() as number),
      },
      {
        id: "action",
        header: () => <span className="sr-only">Action</span>,
        enableSorting: false,
        meta: right,
        cell: ({ row }) => (
          <EditWindowButton
            recordTime={row.original.record_time}
            now={now}
            onEdit={() => setEditingMonthly(row.original)}
          />
        ),
      },
    ],
    [now]
  )

  /** The window may close while the dialog is open; check again on save. */
  async function saveIfStillEditable(
    recordTime: string | null | undefined,
    save: () => Promise<unknown>,
    close: () => void
  ) {
    if (!canEditRecord(recordTime)) {
      toast.error("This entry is now locked", {
        description: `Entries can be edited for ${EDIT_WINDOW_MINUTES} minutes after they're recorded.`,
      })
      close()
      return
    }
    await save()
    close()
  }

  const monthlyDefaults = (e: MonthlyDieselEntry) => {
    const month = monthlyEntryMonth(e)
    return {
      start_date: parseDate(e.start_date) ?? month ?? undefined,
      end_date:
        parseDate(e.end_date) ?? (month ? endOfMonth(month) : undefined),
      quantity: String(num(e.quantity)),
    }
  }

  return (
    <>
      <Tabs defaultValue="daily" className="gap-4">
        <TabsList>
          <TabsTrigger value="daily">Daily entry</TabsTrigger>
          <TabsTrigger value="monthly">Monthly entry</TabsTrigger>
        </TabsList>
        <TabsContent
          value="daily"
          className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Daily diesel entry</CardTitle>
              <CardDescription>
                Litres a generator used over a day or a few days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DailyEntryForm
                isNew
                onSubmit={(input) => addDaily.mutateAsync(input)}
              />
            </CardContent>
          </Card>
          <SectionCard
            title="Daily entries"
            description={periodText}
            hint={`You can edit an entry for ${EDIT_WINDOW_MINUTES} minutes after recording it.`}
            error={entries.daily.isError}
            onRetry={() => void entries.daily.refetch()}
          >
            <DataTable
              columns={dailyColumns}
              data={dailyRows}
              isLoading={entries.daily.isPending}
              emptyText="No daily entries in this period."
            />
          </SectionCard>
        </TabsContent>
        <TabsContent
          value="monthly"
          className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Monthly diesel entry</CardTitle>
              <CardDescription>
                Total litres used over a period, when daily records aren&apos;t
                kept.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyEntryForm
                isNew
                onSubmit={(input) => addMonthly.mutateAsync(input)}
              />
            </CardContent>
          </Card>
          <SectionCard
            title="Monthly entries"
            description={periodText}
            hint={`You can edit an entry for ${EDIT_WINDOW_MINUTES} minutes after recording it.`}
            error={entries.monthly.isError}
            onRetry={() => void entries.monthly.refetch()}
          >
            <DataTable
              columns={monthlyColumns}
              data={monthlyRows}
              isLoading={entries.monthly.isPending}
              pageSize={6}
              emptyText="No monthly entries in this period."
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <EditDialog
        open={editingDaily !== null}
        onOpenChange={(open) => !open && setEditingDaily(null)}
        title="Edit daily diesel entry"
        description={
          editingDaily
            ? `${editMinutesLeft(editingDaily.record_time, now)} min left to edit this entry.`
            : undefined
        }
      >
        {editingDaily && (
          <DailyEntryForm
            submitLabel="Save changes"
            defaultValues={{
              start_date: parseDate(editingDaily.start_date) ?? undefined,
              end_date:
                parseDate(editingDaily.end_date ?? editingDaily.start_date) ??
                undefined,
              quantity: String(num(editingDaily.quantity)),
              generator_id: editingDaily.device_id
                ? String(editingDaily.device_id)
                : undefined,
            }}
            onCancel={() => setEditingDaily(null)}
            onSubmit={(input) =>
              saveIfStillEditable(
                editingDaily.record_time,
                () =>
                  update.mutateAsync({
                    id: editingDaily.id,
                    input: { ...input, type: "Daily" },
                  }),
                () => setEditingDaily(null)
              )
            }
          />
        )}
      </EditDialog>
      <EditDialog
        open={editingMonthly !== null}
        onOpenChange={(open) => !open && setEditingMonthly(null)}
        title="Edit monthly diesel entry"
        description={
          editingMonthly
            ? `${editMinutesLeft(editingMonthly.record_time, now)} min left to edit this entry.`
            : undefined
        }
      >
        {editingMonthly && (
          <MonthlyEntryForm
            submitLabel="Save changes"
            defaultValues={monthlyDefaults(editingMonthly)}
            onCancel={() => setEditingMonthly(null)}
            onSubmit={(input) =>
              saveIfStillEditable(
                editingMonthly.record_time,
                () =>
                  update.mutateAsync({
                    id: editingMonthly.id,
                    input: { ...input, type: "Monthly" },
                  }),
                () => setEditingMonthly(null)
              )
            }
          />
        )}
      </EditDialog>
    </>
  )
}
