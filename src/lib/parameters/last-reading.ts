import type {
  LastReadingDevice,
  PhaseReading,
  ValueReading,
} from "@/lib/api/parameters-types"
import { displayUnit } from "@/lib/parameters/series"
import { isFuturePeriod, periodEnd, type Period } from "@/lib/period"

/** True for the period that contains "now" (Last Reading then means "latest"). */
export function includesNow(period: Period, now = new Date()) {
  return (
    !isFuturePeriod(period, now) &&
    periodEnd(period, now).getTime() >= now.getTime()
  )
}

/**
 * Last Reading page rules (old LastReadingPageSection.js and its six tables,
 * inventory 03 §1). The old tables printed raw field names such as
 * `active_energy` or `pf_import_at_sliding_winow`; these are the human labels.
 * Field names come from the captured payload (old repo authenticatedData.json).
 */
const LABELS: Record<string, string> = {
  voltage: "Voltage",
  current: "Current",
  active_power: "Active power",
  reactive_power: "Reactive power",
  apparent_power: "Apparent power",
  pf: "Power factor",
  power_factor: "Power factor",
  frequency: "Frequency",
  "neutral current": "Neutral current",
  neutral_current: "Neutral current",
  voltage_thd_ln: "Voltage THD (line–neutral)",
  voltage_thd_ll: "Voltage THD (line–line)",
  voltage_thd: "Voltage THD",
  current_thd: "Current THD",
  current_tdd: "Current TDD",
  active_energy: "Active energy (import)",
  active_energy_import: "Active energy (import)",
  active_energy_export: "Active energy (export)",
  reactive_energy: "Reactive energy",
  apparent_energy: "Apparent energy",
  max_amp: "Maximum current",
  max_power_demand: "Maximum power demand",
  accumulated_power_demand: "Accumulated power demand",
  max_kva_demand: "Maximum kVA demand",
  kva_demand: "kVA demand",
  power_demand: "Power demand",
  accumulated_kva_demand: "Accumulated kVA demand",
  pf_import_at_sliding_winow: "Power factor (import, sliding window)",
  pf_import_at_sliding_window: "Power factor (import, sliding window)",
}

/** "active_energy" → "Active energy (import)"; unknown names are de-snaked. */
export function readingLabel(name: string) {
  const known = LABELS[name.trim().toLowerCase()]
  if (known) return known
  const text = name.replace(/_/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export type ReadingSection =
  | { key: string; title: string; kind: "phase"; rows: PhaseReading[] }
  | { key: string; title: string; kind: "value"; rows: ValueReading[] }

/** The six snapshot tables, in the old page's order. Empty ones are dropped. */
export function readingSections(device: LastReadingDevice): ReadingSection[] {
  const data = device.last_reading?.data
  const sections: ReadingSection[] = [
    {
      key: "phase",
      title: "Phase measurements",
      kind: "phase",
      rows: data?.phase_measures ?? [],
    },
    { key: "totals", title: "Totals", kind: "value", rows: data?.totals ?? [] },
    {
      key: "harmonics",
      title: "Harmonic distortion",
      kind: "phase",
      rows: data?.harmonic_distortion ?? [],
    },
    { key: "energy", title: "Energy", kind: "value", rows: data?.energy ?? [] },
    {
      key: "demands",
      title: "Demands",
      kind: "phase",
      rows: data?.demands ?? [],
    },
    {
      key: "total-demand",
      title: "Total demand",
      kind: "value",
      rows: data?.total_demands ?? [],
    },
  ]
  return sections.filter((s) => s.rows.length > 0)
}

export const readingUnit = (unit: string | undefined) => displayUnit(unit)

/** CSV rows: every section of one device, one line per measurement. The old
 * CSV held only the phase table. */
export function readingCsvRows(
  device: LastReadingDevice
): Array<Record<string, string | number>> {
  return readingSections(device).flatMap(
    (section): Array<Record<string, string | number>> =>
      section.kind === "phase"
        ? section.rows.map((r) => ({
            section: section.title,
            measurement: readingLabel(r.name),
            l1: r.l1 ?? 0,
            l2: r.l2 ?? 0,
            l3: r.l3 ?? 0,
            value: "",
            unit: readingUnit(r.unit),
          }))
        : section.rows.map((r) => ({
            section: section.title,
            measurement: readingLabel(r.name),
            l1: "",
            l2: "",
            l3: "",
            value: r.value ?? 0,
            unit: readingUnit(r.unit),
          }))
  )
}
