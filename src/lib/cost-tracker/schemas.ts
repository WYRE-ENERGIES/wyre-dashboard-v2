import { endOfDay, startOfDay } from "date-fns"
import { z } from "zod"

/**
 * Form validation for the cost-tracker forms, ported from the old antd field
 * rules (components/FormFields/GeneralFormFields.js, helpers validate2DecNo):
 *  - amounts: required, > 0, at most 2 decimal places, at most 16 integer digits
 *  - daily diesel quantity: required, whole number ≥ 0
 *  - dates: required where the old form required them
 * Number inputs are strings in the form and numbers after parsing.
 */

const clean = (raw: string) => raw.replace(/[,\s]/g, "")

/** > 0, ≤ 2 dp, ≤ 16 integer digits (old NumberField). */
export const amount = (label: string) =>
  z
    .string()
    .superRefine((raw, ctx) => {
      const v = clean(raw)
      if (!v)
        return void ctx.addIssue({
          code: "custom",
          message: `Enter the ${label}`,
        })
      if (!/^\d+(\.\d+)?$/.test(v))
        return void ctx.addIssue({
          code: "custom",
          message: `Enter a valid ${label}`,
        })
      if (!/^\d+(\.\d{1,2})?$/.test(v))
        return void ctx.addIssue({
          code: "custom",
          message: `Use at most 2 decimal places`,
        })
      if (v.split(".")[0].replace(/^0+/, "").length > 16)
        return void ctx.addIssue({
          code: "custom",
          message: `The ${label} is too large`,
        })
      if (Number(v) <= 0)
        ctx.addIssue({
          code: "custom",
          message: `The ${label} must be greater than zero`,
        })
    })
    .transform((raw) => Number(clean(raw)))

/** Whole number ≥ min (old NumberFieldAcceptZero uses 0). */
export const wholeNumber = (label: string, min = 0) =>
  z
    .string()
    .superRefine((raw, ctx) => {
      const v = clean(raw)
      if (!v)
        return void ctx.addIssue({
          code: "custom",
          message: `Enter the ${label}`,
        })
      if (!/^\d+$/.test(v))
        return void ctx.addIssue({
          code: "custom",
          message: `The ${label} must be a whole number`,
        })
      if (Number(v) < min)
        ctx.addIssue({
          code: "custom",
          message:
            min === 1
              ? `The ${label} must be at least 1`
              : `Enter the ${label}`,
        })
    })
    .transform((raw) => Number(clean(raw)))

const requiredDate = (message = "Select a date") => z.date({ error: message })
const notFuture = (d: Date | undefined) => !d || d <= endOfDay(new Date())
const endNotBeforeStart = (start: Date | undefined, end: Date | undefined) =>
  !start || !end || startOfDay(end) >= startOfDay(start)

export const dieselPurchaseSchema = z.object({
  quantity: amount("quantity"),
  price_per_litre: amount("price per litre"),
  date: requiredDate().refine(notFuture, "The date can't be in the future"),
})
export type DieselPurchaseForm = z.input<typeof dieselPurchaseSchema>
export type DieselPurchaseValues = z.output<typeof dieselPurchaseSchema>

/**
 * Pre-paid utility and IPP: amount, value (kWh) and the purchase date.
 * Post-paid also has `end_date` (the period covered; it defaults to the start).
 */
export const paymentSchema = z
  .object({
    amount: amount("amount"),
    value: amount("value"),
    date: requiredDate().refine(notFuture, "The date can't be in the future"),
    end_date: z.date().optional(),
  })
  .refine((v) => endNotBeforeStart(v.date, v.end_date), {
    path: ["end_date"],
    message: "The end date can't be before the start date",
  })
export type PaymentForm = z.input<typeof paymentSchema>
export type PaymentValues = z.output<typeof paymentSchema>

/** Daily diesel entry: from/to dates (no future), whole litres ≥ 0, optional generator. */
export const dailyEntrySchema = z
  .object({
    start_date: requiredDate("Select the from date").refine(
      notFuture,
      "The date can't be in the future"
    ),
    end_date: z
      .date()
      .optional()
      .refine(notFuture, "The date can't be in the future"),
    quantity: wholeNumber("quantity"),
    generator_id: z.string().optional(),
  })
  .refine((v) => endNotBeforeStart(v.start_date, v.end_date), {
    path: ["end_date"],
    message: "The to date can't be before the from date",
  })
export type DailyEntryForm = z.input<typeof dailyEntrySchema>
export type DailyEntryValues = z.output<typeof dailyEntrySchema>

/** Monthly diesel entry: a date range (future dates allowed, as before), litres > 0. */
export const monthlyEntrySchema = z
  .object({
    start_date: requiredDate("Select the start date"),
    end_date: requiredDate("Select the end date"),
    quantity: amount("quantity"),
  })
  .refine((v) => endNotBeforeStart(v.start_date, v.end_date), {
    path: ["end_date"],
    message: "The end date can't be before the start date",
  })
export type MonthlyEntryForm = z.input<typeof monthlyEntrySchema>
export type MonthlyEntryValues = z.output<typeof monthlyEntrySchema>

export const equipmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the equipment name")
    .max(100, "Use at most 100 characters"),
  wattage: amount("wattage"),
  date_purchased: requiredDate().refine(
    notFuture,
    "The date can't be in the future"
  ),
  quantity: wholeNumber("quantity", 1),
})
export type EquipmentForm = z.input<typeof equipmentSchema>
export type EquipmentValues = z.output<typeof equipmentSchema>
