"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import {
  DateField,
  FuelTypeField,
  NumberField,
  ReadOnlyField,
} from "@/components/cost-tracker/form-fields"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import type {
  DieselPurchaseInput,
  PaymentInput,
  PaymentKind,
} from "@/lib/api/cost-tracker-types"
import { tariffOf } from "@/lib/cost-tracker/rules"
import {
  dieselPurchaseSchema,
  paymentSchema,
  type DieselPurchaseForm as DieselPurchaseFields,
  type DieselPurchaseValues,
  type PaymentForm as PaymentFields,
  type PaymentValues,
} from "@/lib/cost-tracker/schemas"
import { formatNaira, formatNumber } from "@/lib/format"
import { isoDate } from "@/lib/period"

/** Parses a typed number for live previews; invalid input counts as 0. */
const live = (raw: unknown) => {
  const n = Number(String(raw ?? "").replace(/[,\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

type FormProps<Input> = {
  defaultValues?: Partial<Record<string, unknown>>
  submitLabel?: string
  onSubmit: (input: Input) => Promise<unknown>
  /** Add forms clear after a successful submit; edit dialogs close instead. */
  resetOnSuccess?: boolean
  onCancel?: () => void
}

export function FormActions({
  pending,
  submitLabel = "Submit",
  onCancel,
}: {
  pending: boolean
  submitLabel?: string
  onCancel?: () => void
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}
        {submitLabel}
      </Button>
    </div>
  )
}

/** Diesel Purchase Tracker (old AddBills.js:328-369, UpdateDieselPurchase.js). */
export function DieselPurchaseForm({
  defaultValues,
  submitLabel,
  onSubmit,
  resetOnSuccess = false,
  onCancel,
}: FormProps<DieselPurchaseInput>) {
  const empty: DieselPurchaseFields = {
    quantity: "",
    price_per_litre: "",
    date: undefined as unknown as Date,
  }
  const form = useForm<DieselPurchaseFields, unknown, DieselPurchaseValues>({
    resolver: zodResolver(dieselPurchaseSchema),
    defaultValues: { ...empty, ...defaultValues },
  })
  const [quantity, price] = useWatch({
    control: form.control,
    name: ["quantity", "price_per_litre"],
  })

  async function submit(values: DieselPurchaseValues) {
    try {
      await onSubmit({
        quantity: values.quantity,
        price_per_litre: values.price_per_litre,
        date: isoDate(values.date),
      })
      if (resetOnSuccess) form.reset(empty)
    } catch {
      // The mutation's error toast explains what went wrong.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <FieldGroup className="gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            control={form.control}
            name="quantity"
            label="Quantity"
            unit="L"
            placeholder="1,000"
          />
          <NumberField
            control={form.control}
            name="price_per_litre"
            label="Price per litre"
            unit="₦/L"
            placeholder="1,250"
          />
          <DateField
            control={form.control}
            name="date"
            label="Date of purchase"
          />
          <FuelTypeField />
        </div>
        <ReadOnlyField
          label="Amount"
          value={formatNaira(live(quantity) * live(price))}
          description="Price per litre × quantity."
        />
        <FormActions
          pending={form.formState.isSubmitting}
          submitLabel={submitLabel}
          onCancel={onCancel}
        />
      </FieldGroup>
    </form>
  )
}

const PAYMENT_DATE_LABEL: Record<PaymentKind, string> = {
  "pre-paid": "Date of purchase",
  ipp: "Date of payment",
  "post-paid": "Period start",
}

/**
 * Utility pre-paid, utility post-paid and IPP payment forms (old
 * AddBills.js:371-541, UpdateUtilityPayment.js, UpdateIppPayment.js). The
 * tariff is computed as amount ÷ value, 2 dp, and can't be typed.
 */
export function PaymentForm({
  kind,
  defaultValues,
  submitLabel,
  onSubmit,
  resetOnSuccess = false,
  onCancel,
}: FormProps<PaymentInput> & { kind: PaymentKind }) {
  const empty: PaymentFields = {
    amount: "",
    value: "",
    date: undefined as unknown as Date,
    end_date: undefined,
  }
  const form = useForm<PaymentFields, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { ...empty, ...defaultValues },
  })
  const [amount, value] = useWatch({
    control: form.control,
    name: ["amount", "value"],
  })
  const postpaid = kind === "post-paid"

  async function submit(values: PaymentValues) {
    const date = isoDate(values.date)
    try {
      await onSubmit({
        amount: values.amount,
        value: values.value,
        tariff: tariffOf(values.amount, values.value),
        date,
        ...(postpaid
          ? { end_date: values.end_date ? isoDate(values.end_date) : date }
          : {}),
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
          <NumberField
            control={form.control}
            name="amount"
            label="Amount"
            unit="₦"
            placeholder="250,000"
          />
          <NumberField
            control={form.control}
            name="value"
            label="Value"
            unit="kWh"
            placeholder="1,200"
          />
          <DateField
            control={form.control}
            name="date"
            label={PAYMENT_DATE_LABEL[kind]}
            onPicked={(start) => {
              const end = form.getValues("end_date")
              if (postpaid && start && end && end < start)
                form.setValue("end_date", start)
            }}
          />
          {postpaid && (
            <DateField
              control={form.control}
              name="end_date"
              label="Period end"
              optional
              disableFuture={false}
              description="Leave empty for a single day."
            />
          )}
          <ReadOnlyField
            label="Tariff (VAT inclusive)"
            value={`₦${formatNumber(tariffOf(live(amount), live(value)))}/kWh`}
            description="Amount ÷ value, worked out for you."
            className={postpaid ? "sm:col-span-2" : undefined}
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
