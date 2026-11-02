"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeftIcon } from "lucide-react"
import { useForm } from "react-hook-form"

import { FormActions } from "@/components/cost-tracker/bill-forms"
import {
  DateField,
  NumberField,
  TextField,
} from "@/components/cost-tracker/form-fields"
import { EditDialog, RowActions } from "@/components/cost-tracker/row-actions"
import { LinkButton, SectionCard } from "@/components/cost-tracker/shared"
import {
  useCostMutation,
  useEquipments,
} from "@/components/cost-tracker/use-cost-tracker"
import { useClaims } from "@/components/session-provider"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import {
  addEquipment,
  deleteEquipment,
  editEquipment,
} from "@/lib/api/cost-tracker"
import type {
  Equipment,
  EquipmentInput,
  EquipmentResponse,
} from "@/lib/api/cost-tracker-types"
import { entryDateLabel, num, parseDate } from "@/lib/cost-tracker/rules"
import {
  equipmentSchema,
  type EquipmentForm as EquipmentFields,
  type EquipmentValues,
} from "@/lib/cost-tracker/schemas"
import { formatNumber } from "@/lib/format"
import { isoDate } from "@/lib/period"

const right = { align: "right" } as const

/** The equipment list comes grouped by branch; keep the selected branch's. */
function branchEquipment(
  response: EquipmentResponse | undefined,
  branchId: number
): Equipment[] {
  const groups = Object.values(response?.data ?? {})
  const group =
    groups.find((g) => g.id === branchId) ??
    (groups.length === 1 ? groups[0] : undefined)
  return (group?.equipments ?? []).map((e) => ({ ...e, branch_id: group?.id }))
}

/**
 * Add Equipment (old mainAppPages/AddEquipment.js, which crashed in
 * production): register the branch's appliances and edit or delete them.
 * Not role-gated, as before. Not date-based, so it ignores the period.
 */
export function AddEquipmentView() {
  const { user_id: userId, branch_id: branchId } = useClaims()
  const query = useEquipments()
  const rows = React.useMemo(
    () => branchEquipment(query.data, branchId),
    [query.data, branchId]
  )
  const [editing, setEditing] = React.useState<Equipment | null>(null)

  const add = useCostMutation(
    (input: EquipmentInput) => addEquipment(userId, branchId, input),
    {
      success: "Equipment added",
      error: "Couldn't add the equipment",
    }
  )
  const update = useCostMutation(
    (v: { id: number; input: EquipmentInput }) =>
      editEquipment(userId, branchId, v.id, v.input),
    { success: "Equipment updated", error: "Couldn't update the equipment" }
  )
  const { mutateAsync: remove } = useCostMutation(
    (row: Equipment) => deleteEquipment(userId, row.branch_id ?? branchId, row),
    {
      success: "Equipment deleted",
      error: "Couldn't delete the equipment",
    }
  )

  const columns = React.useMemo<ColumnDef<Equipment, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Equipment",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "wattage",
        header: "Wattage (W)",
        meta: right,
        accessorFn: (r) => num(r.voltage),
        cell: ({ getValue }) => formatNumber(getValue() as number),
      },
      {
        id: "quantity",
        header: "Quantity",
        meta: right,
        accessorFn: (r) => num(r.quantity),
        cell: ({ getValue }) => formatNumber(getValue() as number, 0),
      },
      {
        id: "total",
        header: "Total load (W)",
        meta: right,
        accessorFn: (r) => num(r.voltage) * num(r.quantity),
        cell: ({ getValue }) => formatNumber(getValue() as number),
      },
      {
        id: "date",
        header: "Date purchased",
        accessorFn: (r) => parseDate(r.date_purchased)?.getTime() ?? 0,
        cell: ({ row }) => entryDateLabel(row.original.date_purchased),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions
            label="equipment"
            onEdit={() => setEditing(row.original)}
            onDelete={() => remove(row.original)}
          />
        ),
      },
    ],
    [remove]
  )
  const totalLoad = rows.reduce(
    (t, r) => t + num(r.voltage) * num(r.quantity),
    0
  )

  return (
    <>
      <PageHeader
        title="Add equipment"
        description="Keep a list of the appliances at this branch and their power rating."
        actions={
          <LinkButton href="/cost-tracker" variant="ghost">
            <ArrowLeftIcon />
            Cost Tracker
          </LinkButton>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>New equipment</CardTitle>
            <CardDescription>
              Wattage is the rating of one unit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EquipmentForm
              resetOnSuccess
              submitLabel="Add equipment"
              onSubmit={(input) => add.mutateAsync(input)}
            />
          </CardContent>
        </Card>
        <SectionCard
          title="List of equipment"
          description={`${rows.length} ${rows.length === 1 ? "item" : "items"} · ${formatNumber(totalLoad / 1000)} kW in total`}
          error={query.isError}
          onRetry={() => void query.refetch()}
        >
          <DataTable
            columns={columns}
            data={rows}
            isLoading={query.isPending}
            emptyText="No equipment added yet."
          />
        </SectionCard>
      </div>
      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit equipment"
      >
        {editing && (
          <EquipmentForm
            submitLabel="Save changes"
            defaultValues={{
              name: editing.name,
              wattage: String(num(editing.voltage)),
              quantity: String(num(editing.quantity)),
              date_purchased: parseDate(editing.date_purchased) ?? undefined,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await update.mutateAsync({ id: editing.id, input })
              setEditing(null)
            }}
          />
        )}
      </EditDialog>
    </>
  )
}

function EquipmentForm({
  defaultValues,
  submitLabel,
  onSubmit,
  resetOnSuccess = false,
  onCancel,
}: {
  defaultValues?: Partial<EquipmentFields>
  submitLabel: string
  onSubmit: (input: EquipmentInput) => Promise<unknown>
  resetOnSuccess?: boolean
  onCancel?: () => void
}) {
  const empty: EquipmentFields = {
    name: "",
    wattage: "",
    quantity: "1",
    date_purchased: undefined as unknown as Date,
  }
  const form = useForm<EquipmentFields, unknown, EquipmentValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { ...empty, ...defaultValues },
  })

  async function submit(values: EquipmentValues) {
    try {
      await onSubmit({
        name: values.name,
        // The backend stores the wattage as `voltage`.
        voltage: values.wattage,
        quantity: values.quantity,
        date_purchased: isoDate(values.date_purchased),
      })
      if (resetOnSuccess) form.reset(empty)
    } catch {
      // Error toast comes from the mutation.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <FieldGroup className="gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="name"
            label="Equipment name"
            placeholder="Television"
            className="sm:col-span-2"
          />
          <NumberField
            control={form.control}
            name="wattage"
            label="Wattage"
            unit="W"
            placeholder="200"
          />
          <NumberField
            control={form.control}
            name="quantity"
            label="Quantity"
            integer
            placeholder="1"
          />
          <DateField
            control={form.control}
            name="date_purchased"
            label="Date purchased"
            className="sm:col-span-2"
          />
        </div>
        <FormActions
          pending={form.formState.isSubmitting}
          submitLabel={submitLabel}
          onCancel={onCancel}
        />
      </FieldGroup>
    </form>
  )
}
