"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { FormActions } from "@/components/cost-tracker/bill-forms"
import {
  DateField,
  FuelTypeField,
  NumberField,
  SelectField,
} from "@/components/cost-tracker/form-fields"
import { useGenerators } from "@/components/cost-tracker/use-cost-tracker"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FieldGroup } from "@/components/ui/field"
import type {
  DailyEntryInput,
  MonthlyEntryInput,
} from "@/lib/api/cost-tracker-types"
import { EDIT_WINDOW_MINUTES } from "@/lib/cost-tracker/rules"
import {
  dailyEntrySchema,
  monthlyEntrySchema,
  type DailyEntryForm as DailyFields,
  type DailyEntryValues,
  type MonthlyEntryForm as MonthlyFields,
  type MonthlyEntryValues,
} from "@/lib/cost-tracker/schemas"
import { formatDeviceName } from "@/lib/format"
import { isoDate } from "@/lib/period"

type EntryFormProps<Input> = {
  defaultValues?: Partial<Record<string, unknown>>
  submitLabel?: string
  onSubmit: (input: Input) => Promise<unknown>
  /** Add mode: warn about the 30-minute edit window before submitting, then clear. */
  isNew?: boolean
  onCancel?: () => void
}

/**
 * "After submitting you can't edit after 30 minutes" confirmation, shown
 * before every new entry (old AddDieselEntry.js Modal.confirm).
 */
function useSubmitConfirmation<T>(run: (values: T) => Promise<void>) {
  const [pendingValues, setPendingValues] = React.useState<T | null>(null)
  const dialog = (
    <AlertDialog
      open={pendingValues !== null}
      onOpenChange={(open) => !open && setPendingValues(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm submission</AlertDialogTitle>
          <AlertDialogDescription>
            After submitting, you can edit this entry for {EDIT_WINDOW_MINUTES}{" "}
            minutes only. Do you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const values = pendingValues
              setPendingValues(null)
              if (values) void run(values)
            }}
          >
            Yes, submit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return { ask: setPendingValues, dialog }
}

/** Daily diesel entry per generator (old AddDieselEntry.js:427-531, UpdateDieselEntry.js). */
export function DailyEntryForm({
  defaultValues,
  submitLabel = "Submit",
  onSubmit,
  isNew = false,
  onCancel,
}: EntryFormProps<DailyEntryInput>) {
  const generators = useGenerators()
  const empty: DailyFields = {
    start_date: undefined as unknown as Date,
    end_date: undefined,
    quantity: "",
    generator_id: undefined,
  }
  const form = useForm<DailyFields, unknown, DailyEntryValues>({
    resolver: zodResolver(dailyEntrySchema),
    defaultValues: { ...empty, ...defaultValues },
  })
  const [running, setRunning] = React.useState(false)

  async function run(values: DailyEntryValues) {
    const start = isoDate(values.start_date)
    setRunning(true)
    try {
      await onSubmit({
        quantity: values.quantity,
        start_date: start,
        // The end date defaults to the start date.
        end_date: values.end_date ? isoDate(values.end_date) : start,
        generator_id: values.generator_id
          ? Number(values.generator_id)
          : undefined,
      })
      if (isNew) form.reset(empty)
    } catch {
      // Error toast comes from the mutation.
    } finally {
      setRunning(false)
    }
  }
  const confirm = useSubmitConfirmation(run)

  const options = (generators.data ?? []).map((g) => ({
    value: String(g.device_id),
    label: formatDeviceName(g.name),
  }))

  return (
    <>
      <form
        onSubmit={form.handleSubmit((values) =>
          isNew ? confirm.ask(values) : run(values)
        )}
        noValidate
      >
        <FieldGroup className="gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <DateField
              control={form.control}
              name="start_date"
              label="From date"
              onPicked={(start) => {
                // Picking the start sets the end when it's empty or earlier.
                const end = form.getValues("end_date")
                if (start && (!end || end < start))
                  form.setValue("end_date", start)
              }}
            />
            <DateField
              control={form.control}
              name="end_date"
              label="To date"
              optional
            />
            <NumberField
              control={form.control}
              name="quantity"
              label="Quantity"
              unit="L"
              integer
              placeholder="120"
              description="Whole litres; 0 if the generator didn't run."
            />
            <SelectField
              control={form.control}
              name="generator_id"
              label="Generator"
              optional
              options={options}
              disabled={generators.isPending || options.length === 0}
              placeholder={
                generators.isPending
                  ? "Loading generators…"
                  : options.length
                    ? "Select generator"
                    : "No generators found"
              }
            />
            <FuelTypeField />
          </div>
          <FormActions
            pending={running}
            submitLabel={submitLabel}
            onCancel={onCancel}
          />
        </FieldGroup>
      </form>
      {confirm.dialog}
    </>
  )
}

/** Monthly diesel entry (old AddDieselEntry.js:559-608, UpdateMonthlyDieselEntry.js). */
export function MonthlyEntryForm({
  defaultValues,
  submitLabel = "Submit",
  onSubmit,
  isNew = false,
  onCancel,
}: EntryFormProps<MonthlyEntryInput>) {
  const empty: MonthlyFields = {
    start_date: undefined as unknown as Date,
    end_date: undefined as unknown as Date,
    quantity: "",
  }
  const form = useForm<MonthlyFields, unknown, MonthlyEntryValues>({
    resolver: zodResolver(monthlyEntrySchema),
    defaultValues: { ...empty, ...defaultValues },
  })
  const [running, setRunning] = React.useState(false)

  async function run(values: MonthlyEntryValues) {
    setRunning(true)
    try {
      await onSubmit({
        quantity: values.quantity,
        start_date: isoDate(values.start_date),
        end_date: isoDate(values.end_date),
      })
      if (isNew) form.reset(empty)
    } catch {
      // Error toast comes from the mutation.
    } finally {
      setRunning(false)
    }
  }
  const confirm = useSubmitConfirmation(run)

  return (
    <>
      <form
        onSubmit={form.handleSubmit((values) =>
          isNew ? confirm.ask(values) : run(values)
        )}
        noValidate
      >
        <FieldGroup className="gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Future dates allowed, as in the old monthly form. */}
            <DateField
              control={form.control}
              name="start_date"
              label="Start date"
              disableFuture={false}
              onPicked={(start) => {
                const end = form.getValues("end_date")
                if (start && (!end || end < start))
                  form.setValue("end_date", start)
              }}
            />
            <DateField
              control={form.control}
              name="end_date"
              label="End date"
              disableFuture={false}
            />
            <NumberField
              control={form.control}
              name="quantity"
              label="Quantity"
              unit="L"
              placeholder="3,500"
            />
            <FuelTypeField />
          </div>
          <FormActions
            pending={running}
            submitLabel={submitLabel}
            onCancel={onCancel}
          />
        </FieldGroup>
      </form>
      {confirm.dialog}
    </>
  )
}
