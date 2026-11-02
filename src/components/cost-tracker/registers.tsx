"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"

import {
  DieselPurchaseForm,
  PaymentForm,
} from "@/components/cost-tracker/bill-forms"
import { EditDialog, RowActions } from "@/components/cost-tracker/row-actions"
import {
  kwh,
  litres,
  naira,
  SectionCard,
} from "@/components/cost-tracker/shared"
import { useCostMutation } from "@/components/cost-tracker/use-cost-tracker"
import { useClaims } from "@/components/session-provider"
import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import {
  deleteDieselPurchase,
  deletePayment,
  updateDieselPurchase,
  updatePayment,
} from "@/lib/api/cost-tracker"
import type {
  DieselPurchase,
  DieselPurchaseInput,
  Payment,
  PaymentInput,
  PaymentKind,
} from "@/lib/api/cost-tracker-types"
import {
  dieselAmount,
  dieselPurchaseTotals,
  entryDateLabel,
  num,
  parseDate,
  paymentKindOf,
  paymentTariff,
  paymentTotals,
} from "@/lib/cost-tracker/rules"
import { isOperator } from "@/lib/gating"

const right = { align: "right" } as const
const dateSort = (r: { date: string }) => parseDate(r.date)?.getTime() ?? 0

/** Diesel Purchased register (old DieselPurchasedTable). */
export function DieselPurchasesCard({
  rows,
  branchName,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  rows: DieselPurchase[]
  branchName: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const claims = useClaims()
  const operator = isOperator(claims)
  const [editing, setEditing] = React.useState<DieselPurchase | null>(null)

  const update = useCostMutation(
    (v: { id: number; input: DieselPurchaseInput }) =>
      updateDieselPurchase(claims.user_id, claims.branch_id, v.id, v.input),
    {
      success: "Diesel purchase updated",
      error: "Couldn't update the diesel purchase",
    }
  )
  const { mutateAsync: remove } = useCostMutation(
    (id: number) => deleteDieselPurchase(claims.user_id, id),
    {
      success: "Diesel purchase deleted",
      error: "Couldn't delete the diesel purchase",
    }
  )

  const columns = React.useMemo<ColumnDef<DieselPurchase, unknown>[]>(() => {
    const cols: ColumnDef<DieselPurchase, unknown>[] = [
      {
        id: "date",
        header: "Date",
        accessorFn: dateSort,
        cell: ({ row }) => entryDateLabel(row.original.date),
      },
      {
        id: "quantity",
        header: "Quantity (L)",
        meta: right,
        accessorFn: (r) => num(r.quantity),
        cell: ({ getValue }) => litres(getValue() as number),
      },
      {
        id: "tariff",
        header: "Tariff (₦/L)",
        meta: right,
        accessorFn: (r) => num(r.price_per_litre),
        cell: ({ getValue }) => naira(getValue() as number),
      },
      {
        id: "amount",
        header: "Amount (₦)",
        meta: right,
        accessorFn: dieselAmount,
        cell: ({ getValue }) => naira(getValue() as number),
      },
    ]
    if (operator)
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions
            label="diesel purchase"
            onEdit={() => setEditing(row.original)}
            onDelete={() => remove(row.original.id)}
          />
        ),
      })
    return cols
  }, [operator, remove])

  const t = dieselPurchaseTotals(rows)
  return (
    <SectionCard
      title={`Diesel purchased${branchName ? ` for ${branchName}` : ""}`}
      description={`${periodText} · ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
      hint="A register of diesel purchased at the facility. Amount = price per litre × quantity."
      error={isError}
      onRetry={onRetry}
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyText="No diesel purchases recorded in this period."
        footer={{
          date: "Total",
          quantity: litres(t.quantity),
          tariff: `${naira(t.tariff)} avg`,
          amount: naira(t.amount),
        }}
      />
      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit diesel purchase"
      >
        {editing && (
          <DieselPurchaseForm
            submitLabel="Save changes"
            defaultValues={{
              quantity: String(num(editing.quantity)),
              price_per_litre: String(num(editing.price_per_litre)),
              date: parseDate(editing.date) ?? undefined,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await update.mutateAsync({ id: editing.id, input })
              setEditing(null)
            }}
          />
        )}
      </EditDialog>
    </SectionCard>
  )
}

const KIND_LABEL: Record<PaymentKind, string> = {
  "pre-paid": "Pre-paid",
  "post-paid": "Post-paid",
  ipp: "IPP",
}

/**
 * Utility Payments or IPP Payments register (old UtilityPurchasedTable /
 * IppPurchasedTable). Edit and delete use the row's own endpoint: pre-paid,
 * post-paid or ipp.
 */
export function PaymentsCard({
  source,
  rows,
  branchName,
  isLoading,
  isError,
  onRetry,
  periodText,
}: {
  source: "utility" | "ipp"
  rows: Payment[]
  branchName: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  periodText: string
}) {
  const claims = useClaims()
  const operator = isOperator(claims)
  const [editing, setEditing] = React.useState<Payment | null>(null)
  const kindOf = React.useCallback(
    (row: Payment): PaymentKind =>
      source === "ipp" ? "ipp" : paymentKindOf(row),
    [source]
  )
  const noun = source === "ipp" ? "IPP payment" : "utility payment"

  const update = useCostMutation(
    (v: { kind: PaymentKind; id: number; input: PaymentInput }) =>
      updatePayment(claims.user_id, claims.branch_id, v.kind, v.id, v.input),
    {
      success: `${source === "ipp" ? "IPP" : "Utility"} payment updated`,
      error: `Couldn't update the ${noun}`,
    }
  )
  const { mutateAsync: remove } = useCostMutation(
    (v: { kind: PaymentKind; id: number }) =>
      deletePayment(claims.user_id, v.kind, v.id),
    {
      success: `${source === "ipp" ? "IPP" : "Utility"} payment deleted`,
      error: `Couldn't delete the ${noun}`,
    }
  )

  const hasPostpaid =
    source === "utility" && rows.some((r) => paymentKindOf(r) === "post-paid")

  const columns = React.useMemo<ColumnDef<Payment, unknown>[]>(() => {
    const cols: ColumnDef<Payment, unknown>[] = [
      {
        id: "date",
        header: "Date",
        accessorFn: dateSort,
        cell: ({ row }) =>
          entryDateLabel(row.original.date, row.original.end_date),
      },
    ]
    if (hasPostpaid)
      cols.push({
        id: "type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="secondary">{KIND_LABEL[kindOf(row.original)]}</Badge>
        ),
      })
    cols.push(
      {
        id: "value",
        header: "Units (kWh)",
        meta: right,
        accessorFn: (r) => num(r.value),
        cell: ({ getValue }) => kwh(getValue() as number),
      },
      {
        id: "tariff",
        header: "Tariff (₦/kWh)",
        meta: right,
        accessorFn: paymentTariff,
        cell: ({ getValue }) => naira(getValue() as number),
      },
      {
        id: "amount",
        header: "Amount (₦)",
        meta: right,
        accessorFn: (r) => num(r.amount),
        cell: ({ getValue }) => naira(getValue() as number),
      },
      {
        id: "vat",
        header: "VAT-inclusive amount (₦)",
        meta: right,
        accessorFn: (r) => num(r.vat_inclusive_amount),
        cell: ({ getValue }) => naira(getValue() as number),
      }
    )
    if (operator)
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions
            label={
              source === "ipp"
                ? "IPP payment"
                : `${KIND_LABEL[kindOf(row.original)].toLowerCase()} payment`
            }
            onEdit={() => setEditing(row.original)}
            onDelete={() =>
              remove({ kind: kindOf(row.original), id: row.original.id })
            }
          />
        ),
      })
    return cols
  }, [operator, hasPostpaid, kindOf, remove, source])

  const t = paymentTotals(rows)
  const editKind = editing ? kindOf(editing) : "pre-paid"
  return (
    <SectionCard
      title={`${source === "ipp" ? "IPP" : "Utility"} payments${branchName ? ` for ${branchName}` : ""}`}
      description={`${periodText} · ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
      hint={
        source === "ipp"
          ? "A register of payments to your independent power producer (IPP)."
          : "A register of utility (grid) payments: pre-paid tokens and post-paid bills."
      }
      error={isError}
      onRetry={onRetry}
    >
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyText={`No ${noun}s recorded in this period.`}
        footer={{
          date: "Total",
          value: kwh(t.value),
          tariff: `${naira(t.tariff)} avg`,
          amount: naira(t.amount),
          vat: naira(t.vat),
        }}
      />
      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={`Edit ${KIND_LABEL[editKind].toLowerCase()} payment`}
        description={
          editKind === "ipp"
            ? undefined
            : `${KIND_LABEL[editKind]} utility payment`
        }
      >
        {editing && (
          <PaymentForm
            kind={editKind}
            submitLabel="Save changes"
            defaultValues={{
              amount: String(num(editing.amount)),
              value: String(num(editing.value)),
              date: parseDate(editing.date) ?? undefined,
              end_date: editing.end_date
                ? (parseDate(editing.end_date) ?? undefined)
                : undefined,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              await update.mutateAsync({
                kind: editKind,
                id: editing.id,
                input,
              })
              setEditing(null)
            }}
          />
        )}
      </EditDialog>
    </SectionCard>
  )
}
