import { format } from "date-fns"

import type {
  DeviationRow,
  MonthlyReportResponse,
  PowerDemandSegment,
  Qty,
  ReportDeviceEntry,
  SolarEntry,
} from "@/lib/api/report-types"
import { formatDeviceName } from "@/lib/format"

/**
 * Monthly report view model: every client-side calculation of the old
 * components/MonthlyReport .js (origin/dev), as pure functions. Section
 * numbers refer to inventory 04 §4.4.
 */

/**
 * "1,234.5 kWh" → 1234.5. The old report used two parsers that both lost
 * data: `parseEnergy` stripped every non-digit, dropping the decimal point
 * ("1234.5kWh" → 12345), and `parseFloat(s.split(' ')[0])` stopped at the
 * thousands comma ("1,234.5" → 1).
 */
export function parseQuantity(value: Qty): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/)
  const n = match ? Number.parseFloat(match[0]) : 0
  return Number.isFinite(n) ? n : 0
}

const capitalise = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

const PERIODS = [
  "current_month",
  "previous_month_1",
  "previous_month_2",
] as const

/** Source colours: utility the brand purple, generators the lighter purples,
 * solar the brand yellow (same rule as the dashboard's seriesColors). */
export function sourceColor(
  kind: "utility" | "generator" | "solar",
  index = 0
) {
  if (kind === "utility") return "var(--chart-1)"
  if (kind === "solar") return "var(--chart-5)"
  return `var(--chart-${(index % 3) + 2})`
}

export type Source = {
  key: string
  label: string
  kwh: number
  color: string
  percent: number
}

// ---------------------------------------------------------------------------

export function monthlyReportModel(data: MonthlyReportResponse) {
  const isSolar = Boolean(data.has_solar)
  // Branch type drives power-demand buckets (MonthlyReport .js:198-207).
  const isResidential =
    (data.branch_type ?? "").toLowerCase() === "residential" ||
    data.is_commercial === false
  const current = data.energy_generated?.current_month?.devices

  // §3 Energy per source — current month: utility grouped, one entry per
  // generator, solar if any.
  const utilityKwh = (current?.utility ?? []).reduce(
    (sum, d) => sum + parseQuantity(d.device_energy),
    0
  )
  const solarKwh = (current?.solar ?? []).reduce(
    (sum, d) => sum + parseQuantity(d.device_energy),
    0
  )
  const rawSources = [
    {
      key: "utility",
      label: "UTILITY",
      kwh: utilityKwh,
      color: sourceColor("utility"),
    },
    ...(current?.generator?.entries ?? []).map((g, i) => ({
      key: `gen-${i}`,
      label: formatDeviceName(g.name ?? `Generator ${i + 1}`),
      kwh: parseQuantity(g.device_energy),
      color: sourceColor("generator", i),
    })),
    ...(solarKwh > 0
      ? [
          {
            key: "solar",
            label: "SOLAR",
            kwh: solarKwh,
            color: sourceColor("solar"),
          },
        ]
      : []),
  ]
  const sourcesTotal = rawSources.reduce((sum, s) => sum + s.kwh, 0)
  const sources: Source[] = rawSources.map((s) => ({
    ...s,
    percent: sourcesTotal ? (s.kwh / sourcesTotal) * 100 : 0,
  }))

  // §2 Total energy = total_energy + solar for solar sites.
  const totalEnergy =
    parseQuantity(data.total_energy?.value) + (isSolar ? solarKwh : 0)

  return {
    branchName: capitalise(data.branch_name ?? ""),
    month: capitalise(String(data.month ?? "")),
    year: String(data.year ?? ""),
    isSolar,
    isResidential,
    totalEnergy,
    totalEnergyUnit: data.total_energy?.unit || "kWh",
    sources,
    sourcesTotal,
    // §4 Top 7 contributors, sorted by energy.
    topContributors: [...sources].sort((a, b) => b.kwh - a.kwh).slice(0, 7),
    solar: isSolar ? solarSavings(data) : null,
    battery: isSolar ? batteryDailyUsage(data) : null,
    utilityRows: utilityRows(data),
    dieselMonths: dieselMonths(data),
    solarHours: !isSolar && data.solar_hour ? solarHours(data) : null,
    powerDemand: powerDemand(data, isResidential),
    deviationRows: deviationRows(data),
    generatorSizeEfficiency: generatorSizeEfficiency(data),
    fuelEfficiency: fuelEfficiency(data),
    bands: bandCategorisation(data),
    dataEntry:
      data.data_entry?.value != null
        ? Math.min(100, Math.max(0, parseQuantity(data.data_entry.value)))
        : null,
    dataEntryUnit: data.data_entry?.unit || "%",
  }
}

export type MonthlyReportModel = ReturnType<typeof monthlyReportModel>

// ---------------------------------------------------------------------------
// §5a Solar savings impact

function solarSavings(data: MonthlyReportResponse) {
  const entry = (
    period:
      "current_month" | "previous_month_1" | "this_year" | "since_commission"
  ) => data.energy_generated?.[period]?.devices?.solar?.[0] ?? null
  const row = (label: string, e: SolarEntry | null) => ({
    label,
    detail: e?.period_detail ?? null,
    contribution: e ? parseQuantity(e.contribution) : null,
    energyKwh: parseQuantity(e?.solar_energy),
    savings: parseQuantity(e?.savings),
  })
  const current = row("Current month", entry("current_month"))
  const previous = row("Last month", entry("previous_month_1"))
  // Projections = current month × 12 × years (MonthlyReport .js:282-310).
  const projection = (years: number) => ({
    label: `${years}-year projection`,
    detail: `Based on current month × ${years * 12} months`,
    contribution: null,
    energyKwh: current.energyKwh * 12 * years,
    savings: current.savings * 12 * years,
  })
  return {
    current,
    // Month-over-month change, only when last month had savings.
    savingsChangePercent:
      previous.savings > 0
        ? ((current.savings - previous.savings) / previous.savings) * 100
        : null,
    rows: [
      current,
      previous,
      row("This year", entry("this_year")),
      row("Since commission", entry("since_commission")),
    ],
    projections: [projection(5), projection(10)],
  }
}

// ---------------------------------------------------------------------------
// §5b Battery daily usage

function batteryDailyUsage(data: MonthlyReportResponse) {
  const days = data.battery_daily_usage?.days ?? []
  if (!days.length) return null
  const points = days.map((d, i) => {
    const dayNumber = Number.parseInt((d.date ?? "").split("-")[2] ?? "", 10)
    return {
      key: d.date ?? String(i),
      day: Number.isFinite(dayNumber)
        ? String(dayNumber)
        : (d.date ?? String(i + 1)),
      date: d.date ?? "",
      energyKwh: parseQuantity(d.discharge_kwh),
      hours: parseQuantity(d.discharge_hours),
      maxSoc: parseQuantity(d.max_soc),
    }
  })
  const totalEnergy = points.reduce((s, p) => s + p.energyKwh, 0)
  const totalHours = points.reduce((s, p) => s + p.hours, 0)
  const maxHours = Math.max(0, ...points.map((p) => p.hours))
  return {
    points,
    days: points.length,
    totalEnergy,
    totalHours,
    avgHours: totalHours / points.length,
    avgMaxSoc: points.reduce((s, p) => s + p.maxSoc, 0) / points.length,
    // Hidden hours axis: at least 24 h, rounded up to 6 h steps.
    hoursAxisMax: Math.max(24, Math.ceil(maxHours / 6) * 6),
    caption:
      `Day of ${capitalise(String(data.battery_daily_usage?.month ?? data.month ?? ""))} ${data.battery_daily_usage?.year ?? data.year ?? ""}`.trim(),
  }
}

// ---------------------------------------------------------------------------
// §5c Utility consumption (3 months)

function utilityRows(data: MonthlyReportResponse) {
  return PERIODS.flatMap((period) =>
    (data.energy_generated?.[period]?.devices?.utility ?? []).map(
      (d: ReportDeviceEntry, i) => ({
        key: `${period}-${i}`,
        month: capitalise(d.month ?? ""),
        discoKwh: parseQuantity(d.actual_energy),
        wyreKwh: parseQuantity(d.device_energy),
        expectedBill: parseQuantity(d.expected_bill),
        discoCost: parseQuantity(d.actual_cost),
        usageAccuracy: parseQuantity(d.usage_accuracy),
      })
    )
  )
}

// ---------------------------------------------------------------------------
// §5d Diesel consumption: per month, one row per generator; month, actual
// usage and actual cost span the month's rows.

function dieselMonths(data: MonthlyReportResponse) {
  return PERIODS.flatMap((period) => {
    const generator = data.energy_generated?.[period]?.devices?.generator
    const entries = generator?.entries ?? []
    if (!entries.length) return []
    return [
      {
        key: period,
        month: capitalise(entries[0].month ?? ""),
        actualLitres: parseQuantity(generator?.actual_usage),
        actualCost: parseQuantity(entries[0].actual_cost),
        entries: entries.map((e, i) => ({
          key: `${period}-${i}`,
          name: formatDeviceName(e.name ?? `Generator ${i + 1}`),
          energyKwh: parseQuantity(e.device_energy),
          optimalLitres: parseQuantity(e.optimal_usage),
          optimalCost: parseQuantity(e.optimal_cost),
          accuracy: parseQuantity(e.last_bill_accuracy),
        })),
      },
    ]
  })
}

// ---------------------------------------------------------------------------
// §5e Solar hours consumption (non-solar sites)

function solarHours(data: MonthlyReportResponse) {
  const kwh = parseQuantity(data.solar_hour?.value)
  const total = parseQuantity(data.total_energy?.value)
  return {
    kwh,
    unit: data.solar_hour?.unit || "kWh",
    percentOfTotal: total ? (kwh / total) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// §6a/6b Power demand and energy usage breakdown

function powerDemand(data: MonthlyReportResponse, isResidential: boolean) {
  const pd = data.power_demand ?? {}
  const segments: Array<{
    key: string
    label: string
    segment: PowerDemandSegment | undefined
  }> = isResidential
    ? [
        { key: "weekdays", label: "Weekdays", segment: pd.weekdays },
        { key: "weekends", label: "Weekends", segment: pd.weekends },
      ]
    : [
        { key: "operational", label: "Operational", segment: pd.operational },
        {
          key: "non_operational",
          label: "Non-operational",
          segment: pd.non_operational,
        },
        { key: "weekends", label: "Weekend", segment: pd.weekends },
      ]
  const rows = segments.map(({ key, label, segment }) => ({
    key,
    label,
    max: parseQuantity(segment?.peak),
    average: parseQuantity(segment?.average),
    min: parseQuantity(segment?.minimum),
    unit: segment?.unit || "kVA",
    energyKwh: parseQuantity(segment?.total_energy),
  }))
  const totalKwh = rows.reduce((sum, r) => sum + r.energyKwh, 0)
  const periodLabel = (label: string) =>
    isResidential ? label : `${label} period`
  return {
    rows,
    unit: rows[0]?.unit ?? "kVA",
    breakdown: rows.map((r) => ({
      key: r.key,
      category: periodLabel(r.label),
      energyKwh: r.energyKwh,
      percent: totalKwh ? (r.energyKwh / totalKwh) * 100 : 0,
    })),
  }
}

// ---------------------------------------------------------------------------
// §6c Deviation energy and cost. The old table formatted values to strings
// with thousands commas and then ran Number() on them, so anything ≥ 1,000
// showed 0; values stay numeric here.

function deviationRows(data: MonthlyReportResponse) {
  const d = data.energy_deviation_and_cost
  if (!d) return []
  return PERIODS.map((p) => [p, d[p]] as const)
    .filter(
      (entry): entry is readonly [(typeof PERIODS)[number], DeviationRow] =>
        entry[1] != null
    )
    .map(([p, row]) => ({
      key: p,
      month: capitalise(row.month ?? ""),
      category: (row.name ?? "").replace(/\(KWH\)/i, "").trim(),
      energyKwh: parseQuantity(row.value),
      hours: parseQuantity(row.deviation_time_of_use),
      dieselLitres: parseQuantity(row.diesel_consumption),
      costNaira: parseQuantity(row.deviation_cost),
    }))
}

// ---------------------------------------------------------------------------
// §7a Generator size efficiency accuracy

/** "04/2026" → "April 2026". */
export function monthYearLabel(value: string | undefined) {
  if (!value) return null
  const [m, y] = value.split("/").map((s) => Number.parseInt(s, 10))
  if (!m || !y || m < 1 || m > 12) return value
  return format(new Date(y, m - 1, 1), "MMMM yyyy")
}

function generatorSizeEfficiency(data: MonthlyReportResponse) {
  const g = data.generator_size_efficiency
  if (!g) return null
  const current = parseQuantity(g.current_month?.value)
  const previous = parseQuantity(g.previous_month?.value)
  return {
    current,
    unit: g.current_month?.unit || "%",
    change: current - previous,
    best: parseQuantity(g.best_month?.value),
    bestUnit: g.best_month?.unit || g.current_month?.unit || "%",
    bestDate: monthYearLabel(g.best_month?.date),
  }
}

// ---------------------------------------------------------------------------
// §7b Fuel efficiency accuracy comparison

function fuelEfficiency(data: MonthlyReportResponse) {
  const f = data.fuel_efficiency_accuracy_comparison
  if (!f) return null
  return {
    accuracy: parseQuantity(f.accuracy?.value),
    accuracyUnit: f.accuracy?.unit || "%",
    recommended: parseQuantity(f.recommended?.value),
    recommendedUnit: f.recommended?.unit || "kWh/L",
    achieved: parseQuantity(f.achieved?.value),
    achievedUnit: f.achieved?.unit || "kWh/L",
  }
}

// ---------------------------------------------------------------------------
// §7c/7d Band categorisation

/** Band letter from achieved supply hours: > 540 A, > 432 B, > 324 C, > 216 D, else E. */
export function bandLetter(totalHours: number) {
  if (totalHours > 540) return "A"
  if (totalHours > 432) return "B"
  if (totalHours > 324) return "C"
  if (totalHours > 216) return "D"
  return "E"
}

function bandCategorisation(data: MonthlyReportResponse) {
  const bands = Array.isArray(data.utility_band_categorization)
    ? data.utility_band_categorization
    : []
  if (!bands.length) return null
  const rows = bands.map((b, i) => {
    const expected = parseQuantity(b.expected_hours)
    const total = parseQuantity(b.total_hours)
    return {
      key: String(i),
      band: b.band ?? "",
      expectedHours: expected,
      totalHours: total,
      // A negative gap means more supply than expected: no blackout.
      blackoutHours: Math.max(0, expected - total),
      compliance: expected ? (total / expected) * 100 : 0,
    }
  })
  const supplied = rows.reduce((s, r) => s + r.totalHours, 0)
  const expected = rows.reduce((s, r) => s + r.expectedHours, 0)
  return {
    rows,
    // The old badge used the first band's achieved hours.
    letter: bandLetter(rows[0].totalHours),
    suppliedHours: supplied,
    expectedHours: expected,
    blackoutHours: Math.max(0, expected - supplied),
  }
}
