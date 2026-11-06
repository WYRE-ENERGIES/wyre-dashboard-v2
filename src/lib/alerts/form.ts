import { z } from "zod"

import type {
  AlertsData,
  AlertsResponse,
  AlertsSavePayload,
  SocOperator,
} from "@/lib/api/alerts-types"

/**
 * Alerts and Alarms form rules, ported from production
 * (origin/dev mainAppPages/AlertsAndAlarms.js; inventory 03 §7 and 07 §3).
 *
 * Numeric thresholds are kept as text while editing so decimals such as
 * "0.85" can be typed (the old inputs re-parsed every keystroke and dropped
 * the decimal point), and are converted on save.
 */

// ── Weekdays ─────────────────────────────────────────────────────────────
// Mon=0 … Sun=6 (AlertsAndAlarms.js:14-45).

export const WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const DEFAULT_DAYS_CSV = ALL_DAYS.join(",")

/** CSV → sorted unique day indexes; empty or invalid → every day
 * (`normalizeDaysCsv`). */
export function parseDays(csv: string | null | undefined): number[] {
  const days = [
    ...new Set(
      String(csv ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    ),
  ].sort((a, b) => a - b)
  return days.length ? days : [...ALL_DAYS]
}

export const daysToCsv = (days: number[]) =>
  days.length ? parseDays(days.join(",")).join(",") : DEFAULT_DAYS_CSV

/** "18:30" → "6:30 PM" (`formatScheduleTimeLabel`). */
export function formatTime12h(time24: string) {
  const [h, m] = time24.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time24
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

export const formatThreshold = ({
  operator,
  value,
}: {
  operator: SocOperator
  value: number
}) => `${operator === "gte" ? "≥" : "≤"} ${value}%`

/** Live battery email: at most two status times, and one drop plus one rise. */
export const MAX_SCHEDULE_TIMES = 2

export const THRESHOLD_OPERATORS: Array<{ value: SocOperator; label: string }> =
  [
    { value: "lte", label: "Drops to / below (≤)" },
    { value: "gte", label: "Rises to / above (≥)" },
  ]

// ── Fields ───────────────────────────────────────────────────────────────

/** On/off switches posted as booleans in `data`. */
const SWITCHES = [
  "daily_energy_usage_alerts",
  "weekly_energy_usage_alerts",
  "daily_unfavorable_weather_alerts",
  "solar_capacity_utilization_alerts",
  "power_factor_alerts",
  "load_balance_alerts",
  "frequency_alerts",
  "voltage_alerts",
  "baseline_alerts",
  "energy_usage_alerts",
  "emitted_co2_alerts",
  "set_co2_alerts",
  "operating_time_alerts",
  "load_alerts",
] as const

/** Numeric thresholds, edited as text. */
const NUMBERS = [
  "solar_capacity_utilization_threshold_pct",
  "max_power_factor",
  "min_power_factor",
  "frequency_precision",
  "max_voltage",
  "min_voltage",
  "energy_usage_max",
  "set_co2_value",
  "load_threshold_value",
] as const

export type SwitchKey = (typeof SWITCHES)[number]
type NumberKey = (typeof NUMBERS)[number]

/**
 * Keys never posted back: `solar_power_demand_alerts` is read-only per the
 * spec PDF (production still posts it — 07 §3.4), and the `*_alerted_at` /
 * `*_alerted_on` fields are the server's own send bookkeeping.
 */
const isReadOnlyKey = (key: string) =>
  key === "solar_power_demand_alerts" ||
  key.endsWith("_alerted_at") ||
  key.endsWith("_alerted_on")

const isNumeric = (v: string) => v === "" || Number.isFinite(Number(v))
const numericText = z.string().trim().refine(isNumeric, "Enter a number")

const socSchema = z.object({
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  schedule_times: z.array(z.object({ time: z.string() })),
  thresholds: z.array(
    z.object({ operator: z.enum(["lte", "gte"]), value: z.number() })
  ),
})

const baseSchema = z.object({
  ...(Object.fromEntries(SWITCHES.map((k) => [k, z.boolean()])) as Record<
    SwitchKey,
    z.ZodBoolean
  >),
  ...(Object.fromEntries(NUMBERS.map((k) => [k, numericText])) as Record<
    NumberKey,
    typeof numericText
  >),
  daily_energy_usage_days: z.array(z.number()).min(1, "Pick at least one day"),
  soc: socSchema,
})

export type AlertsFormValues = z.infer<typeof baseSchema>

/**
 * The form schema. Rules apply only to fields the user can see: solar-only
 * accounts don't see the power-quality and customised rows.
 */
export function makeAlertsSchema({ solarOnly }: { solarOnly: boolean }) {
  return baseSchema.superRefine((v, ctx) => {
    const num = (key: NumberKey) => (v[key] === "" ? null : Number(v[key]))
    const issue = (key: NumberKey, message: string) =>
      ctx.addIssue({ code: "custom", path: [key], message })

    // Solar capacity: 0–90 (empty means the default, 90).
    const solar = num("solar_capacity_utilization_threshold_pct")
    if (solar !== null && (solar < 0 || solar > 90)) {
      issue(
        "solar_capacity_utilization_threshold_pct",
        "Enter a percentage from 0 to 90"
      )
    }
    if (solarOnly) return

    const required = (on: boolean, key: NumberKey, label: string) => {
      if (on && num(key) === null)
        issue(key, `Enter ${label} to turn this alert on`)
    }
    const atLeast = (key: NumberKey, min: number, message: string) => {
      const n = num(key)
      if (n !== null && n < min) issue(key, message)
    }
    const lowBelowHigh = (low: NumberKey, high: NumberKey) => {
      const lo = num(low)
      const hi = num(high)
      if (lo !== null && hi !== null && lo >= hi)
        issue(low, "The low limit must be below the high limit")
    }

    // Power factor: 0–1, low < high.
    for (const key of ["max_power_factor", "min_power_factor"] as const) {
      const n = num(key)
      if (n !== null && (n < 0 || n > 1))
        issue(key, "Power factor must be between 0 and 1")
    }
    required(v.power_factor_alerts, "max_power_factor", "a high power factor")
    required(v.power_factor_alerts, "min_power_factor", "a low power factor")
    lowBelowHigh("min_power_factor", "max_power_factor")

    atLeast("frequency_precision", 0, "Frequency variance can't be negative")
    required(v.frequency_alerts, "frequency_precision", "a frequency variance")

    atLeast("max_voltage", 0, "Voltage can't be negative")
    atLeast("min_voltage", 0, "Voltage can't be negative")
    required(v.voltage_alerts, "max_voltage", "a high voltage")
    required(v.voltage_alerts, "min_voltage", "a low voltage")
    lowBelowHigh("min_voltage", "max_voltage")

    atLeast("energy_usage_max", 0, "Energy target can't be negative")
    required(v.energy_usage_alerts, "energy_usage_max", "an energy target")
    atLeast("set_co2_value", 0, "CO₂ target can't be negative")
    required(v.set_co2_alerts, "set_co2_value", "a CO₂ target")
    atLeast("load_threshold_value", 0, "Load can't be negative")
    required(v.load_alerts, "load_threshold_value", "a load limit")
  })
}

const toText = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  !Number.isFinite(Number(value))
    ? ""
    : String(Number(value))

const toTime = (time: string) => time.slice(0, 5)

/** GET response → form values (AlertsAndAlarms.js:149-195). */
export function toFormValues(
  response: AlertsResponse | undefined
): AlertsFormValues {
  const data: AlertsData = response?.data ?? {}
  const soc = response?.battery_soc_config
  const solarPct = toText(data.solar_capacity_utilization_threshold_pct)
  return {
    ...(Object.fromEntries(
      SWITCHES.map((k) => [k, Boolean(data[k])])
    ) as Record<SwitchKey, boolean>),
    ...(Object.fromEntries(NUMBERS.map((k) => [k, toText(data[k])])) as Record<
      NumberKey,
      string
    >),
    // Clamped on load, default 90.
    solar_capacity_utilization_threshold_pct:
      solarPct === ""
        ? "90"
        : String(Math.min(90, Math.max(0, Number(solarPct)))),
    daily_energy_usage_days: parseDays(data.daily_energy_usage_days),
    soc: {
      email_enabled: Boolean(
        data.daily_battery_soc_alerts ?? soc?.email_enabled
      ),
      push_enabled: Boolean(soc?.push_enabled),
      // Every time now uses the operational days, so per-time weekdays are
      // not read. Times and thresholds beyond the new limits (set up before
      // them) are kept and shown, not dropped: the live page drops them
      // silently and the next save deletes them (inventory 07 §9.5).
      schedule_times: (soc?.schedule_times ?? [])
        .map((t) => ({ time: toTime(t.time) }))
        .sort((a, b) => a.time.localeCompare(b.time)),
      thresholds: (soc?.thresholds ?? []).map((t) => ({
        operator: t.operator,
        value: Number(t.value),
      })),
    },
  }
}

/**
 * Form values → POST body (handleAlertsSubmit, AlertsAndAlarms.js:302-343):
 * the GET's `data` with edits applied, minus read-only keys; an empty
 * threshold keeps the value it had (the solar % defaults to 90); the battery
 * SOC block is sent only when the GET returned one.
 */
export function toPayload(
  response: AlertsResponse | undefined,
  values: AlertsFormValues
): AlertsSavePayload {
  const original: AlertsData = response?.data ?? {}
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(original).filter(([key]) => !isReadOnlyKey(key))
  )
  for (const key of SWITCHES) data[key] = values[key]
  for (const key of NUMBERS) {
    const text = values[key].trim()
    data[key] = text === "" ? (original[key] ?? null) : Number(text)
  }
  const solar = values.solar_capacity_utilization_threshold_pct.trim()
  data.solar_capacity_utilization_threshold_pct =
    solar === "" ? 90 : Math.min(90, Math.max(0, Number(solar)))
  data.daily_energy_usage_days = daysToCsv(values.daily_energy_usage_days)

  const payload: AlertsSavePayload = {
    data,
    generator_data: response?.generator_data ?? [],
  }

  if (response?.battery_soc_config) {
    const { email_enabled, schedule_times, thresholds } = values.soc
    // Push has no switch on the page, so it keeps the server's value. The
    // live page posts `push_enabled: false`, which turns push off on every
    // save (inventory 07 §9.5); the spec says it must not be switched off.
    const push_enabled = Boolean(response.battery_soc_config.push_enabled)
    data.daily_battery_soc_alerts = email_enabled
    payload.battery_soc_config = {
      is_enabled: email_enabled || push_enabled,
      push_enabled,
      email_enabled,
      // As on the live page every status time uses the operational days. The
      // limits (two times, one drop and one rise) apply to adding entries;
      // older extras are sent back until the user removes them.
      schedule_times: schedule_times.map(({ time }) => {
        const csv = daysToCsv(values.daily_energy_usage_days)
        return csv === DEFAULT_DAYS_CSV ? { time } : { time, days_of_week: csv }
      }),
      thresholds: thresholds.map(({ operator, value }) => ({
        operator,
        value,
      })),
    }
  }
  return payload
}

/** Save errors: a string `error`, nested `error` objects flattened to
 * "key: v1, v2; …", or `message` (formatApiError, AlertsAndAlarms.js:95-111). */
export function formatAlertsError(body: unknown): string {
  const fallback = "Something unexpected occurred, please try again."
  if (!body) return fallback
  if (typeof body === "string") return body
  const { error, message } = body as { error?: unknown; message?: unknown }
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const nested = Object.entries(error)
      .map(([key, value]) =>
        Array.isArray(value)
          ? `${key}: ${value.join(", ")}`
          : typeof value === "object" && value !== null
            ? `${key}: ${JSON.stringify(value)}`
            : `${key}: ${String(value)}`
      )
      .join("; ")
    if (nested) return nested
  }
  return typeof message === "string" ? message : fallback
}

// ── Save model (live page, inventory 07 §9.1) ─────────────────────────────
// Switches save on their own as soon as they are flipped. Days, battery
// times and thresholds, and the numeric limits are drafts until "Save".

/** A switch that saves on its own; the battery email lives under `soc`. */
export type SwitchName = SwitchKey | "soc.email_enabled"

export const switchValue = (values: AlertsFormValues, name: SwitchName) =>
  name === "soc.email_enabled" ? values.soc.email_enabled : values[name]

export function withSwitch(
  values: AlertsFormValues,
  name: SwitchName,
  checked: boolean
): AlertsFormValues {
  return name === "soc.email_enabled"
    ? { ...values, soc: { ...values.soc, email_enabled: checked } }
    : { ...values, [name]: checked }
}

/** Comparable form of the draft fields (`hasSaveableChanges`): blank equals
 * blank, numbers compare by value. */
export function draftKey(values: AlertsFormValues) {
  return JSON.stringify({
    days: daysToCsv(values.daily_energy_usage_days),
    times: values.soc.schedule_times.map((t) => t.time),
    thresholds: values.soc.thresholds.map((t) => [t.operator, Number(t.value)]),
    limits: NUMBERS.map((key) => {
      const text = values[key].trim()
      return text === "" ? "" : Number(text)
    }),
  })
}

/** `values` with its draft fields taken from `from` (Discard). */
export function withDrafts(
  values: AlertsFormValues,
  from: AlertsFormValues
): AlertsFormValues {
  return {
    ...values,
    ...(Object.fromEntries(NUMBERS.map((k) => [k, from[k]])) as Record<
      NumberKey,
      string
    >),
    daily_energy_usage_days: from.daily_energy_usage_days,
    soc: {
      ...values.soc,
      schedule_times: from.soc.schedule_times,
      thresholds: from.soc.thresholds,
    },
  }
}

/** The GET response as it stands after `payload` was saved, for the cache. */
export function withSavedPayload(
  response: AlertsResponse,
  payload: AlertsSavePayload
): AlertsResponse {
  const soc = response.battery_soc_config
  const sent = payload.battery_soc_config
  return {
    ...response,
    data: { ...response.data, ...payload.data } as AlertsData,
    battery_soc_config:
      soc && sent
        ? {
            ...soc,
            ...sent,
            schedule_times: sent.schedule_times.map((t) => ({
              time: t.time,
              days_of_week: t.days_of_week ?? DEFAULT_DAYS_CSV,
            })),
          }
        : soc,
  }
}
