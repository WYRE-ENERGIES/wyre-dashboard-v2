import type {
  PhaseSeries,
  PowerQualityDevice,
} from "@/lib/api/parameters-types"
import {
  bucketize,
  displayUnit,
  periodBuckets,
  type Bucket,
} from "@/lib/parameters/series"
import { GRANULARITY, type Period } from "@/lib/period"

/**
 * Power Quality page rules (old PowerQualityPageSection.js, inventory 03 §4).
 * The measure switch replaces the old top-bar "plotted unit" select, which
 * offered Current (Amps), Voltage (Volts), Active-Power (kW) and
 * Reactive-Power (kVar) (RevisedAppTopBar.js:124-140).
 */
export const MEASURES = [
  { key: "current", label: "Current", fallbackUnit: "A" },
  { key: "voltage", label: "Voltage", fallbackUnit: "V" },
  { key: "active_power", label: "Active power", fallbackUnit: "kW" },
  { key: "reactive_power", label: "Reactive power", fallbackUnit: "kVAr" },
] as const

export type MeasureKey = (typeof MEASURES)[number]["key"]

export const PHASES = [
  { key: "l1", label: "Line 1" },
  { key: "l2", label: "Line 2" },
  { key: "l3", label: "Line 3" },
  { key: "neutral", label: "Neutral" },
] as const

type PhaseKey = (typeof PHASES)[number]["key"]

export type QualityRow = Bucket & {
  l1: number | null
  l2: number | null
  l3: number | null
  neutral: number | null
  frequency: number | null
  powerFactor: number | null
  hasData: boolean
}

/**
 * One device's series for the chosen measure, averaged into the period's
 * buckets. Frequency is `frequency.average[]` and power factor
 * `power_factor.l1_l2_l3[]`, as in the old table. The neutral line is only
 * shown when it carries a non-zero value (the old table hid it; the chart
 * plotted it whenever present).
 */
export function qualitySeries(
  device: PowerQualityDevice,
  measure: MeasureKey,
  period: Period
) {
  const granularity = GRANULARITY[period.kind]
  const pq = device.power_quality
  const dates = pq?.dates?.dates
  const series: PhaseSeries | undefined = pq?.[measure]
  const meta = MEASURES.find((m) => m.key === measure)!
  const unit = displayUnit(series?.units, meta.fallbackUnit)

  const phases = Object.fromEntries(
    PHASES.map((p) => [
      p.key,
      bucketize(dates, series?.[p.key], granularity, "mean"),
    ])
  ) as Record<PhaseKey, Map<string, number>>
  const frequency = bucketize(
    dates,
    pq?.frequency?.average,
    granularity,
    "mean"
  )
  const powerFactor = bucketize(
    dates,
    pq?.power_factor?.l1_l2_l3,
    granularity,
    "mean"
  )

  const rows: QualityRow[] = periodBuckets(period).map((bucket) => {
    const pick = (map: Map<string, number>) => map.get(bucket.key) ?? null
    const row = {
      ...bucket,
      l1: pick(phases.l1),
      l2: pick(phases.l2),
      l3: pick(phases.l3),
      neutral: pick(phases.neutral),
      frequency: pick(frequency),
      powerFactor: pick(powerFactor),
    }
    return {
      ...row,
      hasData: [row.l1, row.l2, row.l3, row.frequency, row.powerFactor].some(
        (v) => v !== null
      ),
    }
  })

  const showNeutral = [...phases.neutral.values()].some((v) => v !== 0)
  const lines = PHASES.filter((p) => p.key !== "neutral" || showNeutral).filter(
    (p) => phases[p.key].size > 0
  )

  return {
    unit,
    measureLabel: meta.label,
    lines,
    showNeutral,
    rows,
    tableRows: rows.filter((r) => r.hasData),
    frequencyUnit: displayUnit(pq?.frequency?.units, "Hz") || "Hz",
  }
}
