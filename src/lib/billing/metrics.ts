import {
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  isValid,
  parse,
  parseISO,
} from "date-fns"

import type {
  BillingBranch,
  BillingDevice,
  BillingResponse,
  BillingSeries,
} from "@/lib/api/billing-types"
import { GRANULARITY, periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Billing rules, ported from organizationDataHelpers.js:580-760
 * (getBillingRefinedOrganizationData) and Billing.js:
 * - per-device previous / present totals (kWh → ₦);
 * - overall totals = Σ branch `billing_totals` (or Σ device totals when the
 *   device filter is on — the old page hid the totals in that case);
 * - kWh chart: one series per device; ₦ chart: element-wise sum of devices.
 *
 * New: only the current branch is shown (decision #1), the device filter
 * applies, and the series are bucketed to the period's granularity
 * (hourly / daily / monthly) because billing_data takes no interval.
 */

const n = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0

/** The current branch's entry; every branch when none matches (the endpoint
 * is keyed by user, so it may return the whole organisation). */
export function currentBranches(
  data: BillingResponse | undefined,
  branchId: number,
  branchName?: string
) {
  const branches = data?.authenticatedData.branches ?? []
  const match = branches.filter(
    (b) =>
      b.branch_id === branchId ||
      b.id === branchId ||
      (branchName !== undefined && b.name === branchName)
  )
  return match.length ? match : branches
}

export function deviceInSelection(
  device: BillingDevice,
  selectedIds: number[],
  selectedNames: string[]
) {
  if (!selectedIds.length) return true
  if (device.device_id !== undefined)
    return selectedIds.includes(device.device_id)
  return selectedNames.includes(device.name)
}

export type DeviceBill = {
  key: string
  name: string
  deviceType?: string
  previousKwh: number
  previousNaira: number
  presentKwh: number
  presentNaira: number
}

export function billSummary(
  branches: BillingBranch[],
  selectedIds: number[],
  selectedNames: string[]
) {
  const filtered = selectedIds.length > 0
  const devices = branches.flatMap((b) =>
    b.devices
      .filter((d) => deviceInSelection(d, selectedIds, selectedNames))
      .map((d) => ({ branch: b, device: d }))
  )
  const rows: DeviceBill[] = devices.map(({ branch, device }, index) => {
    const t = device.billing?.totals
    return {
      key: `${branch.name}-${device.device_id ?? device.id ?? index}`,
      name:
        branches.length > 1 ? `${branch.name} · ${device.name}` : device.name,
      deviceType: device.device_type,
      previousKwh: n(t?.previous_total?.usage_kwh),
      previousNaira: n(t?.previous_total?.value_naira),
      presentKwh: n(t?.present_total?.usage_kwh),
      presentNaira: n(t?.present_total?.value_naira),
    }
  })

  const sumRows = (pick: (r: DeviceBill) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0)
  const sumBranches = (pick: (b: BillingBranch) => number | null | undefined) =>
    branches.reduce((acc, b) => acc + n(pick(b)), 0)
  const haveBranchTotals =
    !filtered && branches.some((b) => b.billing_totals?.present_total)

  const totals = haveBranchTotals
    ? {
        presentKwh: sumBranches(
          (b) => b.billing_totals?.present_total?.usage_kwh
        ),
        presentNaira: sumBranches(
          (b) => b.billing_totals?.present_total?.value_naira
        ),
        previousKwh: sumBranches(
          (b) => b.billing_totals?.previous_total?.usage_kwh
        ),
        previousNaira: sumBranches(
          (b) => b.billing_totals?.previous_total?.value_naira
        ),
      }
    : {
        presentKwh: sumRows((r) => r.presentKwh),
        presentNaira: sumRows((r) => r.presentNaira),
        previousKwh: sumRows((r) => r.previousKwh),
        previousNaira: sumRows((r) => r.previousNaira),
      }

  return { rows, totals, devices: devices.map((d) => d.device) }
}

// ── Time series ──────────────────────────────────────────────────────────

const FORMATS = [
  "dd-MM-yyyy HH:mm",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
  "dd-MM-yyyy",
]

/** Billing dates arrive as ISO strings; tolerate the DD-MM-YYYY forms too. */
export function parseApiDate(value: string) {
  const iso = parseISO(value)
  if (isValid(iso)) return iso
  for (const f of FORMATS) {
    const d = parse(value, f, new Date())
    if (isValid(d)) return d
  }
  return null
}

const KEY = {
  hourly: "yyyy-MM-dd HH",
  daily: "yyyy-MM-dd",
  monthly: "yyyy-MM",
} as const

/** Every bucket of the period, so the axis is complete even with gaps. */
function buckets(period: Period) {
  const start = periodStart(period)
  const end = periodEnd(period)
  const g = GRANULARITY[period.kind]
  if (g === "hourly") {
    return Array.from(
      { length: 24 },
      (_, h) => new Date(start.getTime() + h * 3_600_000)
    )
      .filter((d) => d <= end)
      .map((d) => ({
        key: format(d, KEY.hourly),
        label: format(d, "HH:00"),
        tooltipLabel: format(d, "EEE d MMM, HH:00"),
      }))
  }
  if (g === "daily") {
    return eachDayOfInterval({ start, end }).map((d) => ({
      key: format(d, KEY.daily),
      label: format(d, "d"),
      tooltipLabel: format(d, "EEE d MMM"),
    }))
  }
  return eachMonthOfInterval({ start, end }).map((d) => ({
    key: format(d, KEY.monthly),
    label: format(d, "MMM"),
    tooltipLabel: format(d, "MMMM yyyy"),
  }))
}

function bucketSeries(series: BillingSeries | undefined, period: Period) {
  const out = new Map<string, number>()
  const fmt = KEY[GRANULARITY[period.kind]]
  ;(series?.dates ?? []).forEach((value, i) => {
    const date = parseApiDate(value)
    if (!date) return
    const key = format(date, fmt)
    out.set(key, (out.get(key) ?? 0) + n(series?.values?.[i]))
  })
  return out
}

export type BillingChartRow = { label: string; tooltipLabel: string } & Record<
  string,
  number | string
>

/** kWh per device and ₦ total, one row per bucket. Device keys are "d{index}". */
export function billingSeries(devices: BillingDevice[], period: Period) {
  const slots = buckets(period)
  const kwh = devices.map((d) =>
    bucketSeries(d.billing?.consumption_kwh, period)
  )
  const naira = devices.map((d) =>
    bucketSeries(d.billing?.consumption_naira, period)
  )
  const rows: BillingChartRow[] = slots.map((slot) => {
    const row: BillingChartRow = {
      label: slot.label,
      tooltipLabel: slot.tooltipLabel,
    }
    devices.forEach((_, i) => {
      row[`d${i}`] = kwh[i].get(slot.key) ?? 0
    })
    row.naira = naira.reduce((acc, m) => acc + (m.get(slot.key) ?? 0), 0)
    return row
  })
  return {
    rows,
    series: devices.map((d, i) => ({
      key: `d${i}`,
      name: d.name,
      deviceType: d.device_type,
    })),
  }
}
