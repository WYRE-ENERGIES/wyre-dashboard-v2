import type { SourceUsage } from "@/lib/dashboard/metrics"

/**
 * Daily and periodic report figures, grouped the way those emails present
 * them: Generator, Solar and Grid, with solar savings priced at the grid
 * tariff for the same period.
 */

export type SourceGroupId = "generator" | "solar" | "grid" | "ipp"

const ORDER: SourceGroupId[] = ["generator", "solar", "grid", "ipp"]

export const SOURCE_GROUP_LABEL: Record<SourceGroupId, string> = {
  generator: "Generator",
  solar: "Solar",
  grid: "Grid",
  ipp: "IPP",
}

export type GroupedSource = {
  id: SourceGroupId
  label: string
  kwh: number
  naira: number
  /** True when at least one device in the group had a bill amount. */
  hasCost: boolean
}

export function sourceGroup(deviceType: string): SourceGroupId {
  if (deviceType === "GENERATOR") return "generator"
  if (deviceType === "SOLAR") return "solar"
  if (deviceType === "UTILITY") return "grid"
  return "ipp"
}

export function groupSources(usage: SourceUsage[]): GroupedSource[] {
  const buckets = new Map<SourceGroupId, GroupedSource>()
  for (const source of usage) {
    const id = sourceGroup(source.deviceType)
    const current = buckets.get(id) ?? {
      id,
      label: SOURCE_GROUP_LABEL[id],
      kwh: 0,
      naira: 0,
      hasCost: false,
    }
    current.kwh += source.kwh
    if (source.naira != null) {
      current.naira += source.naira
      current.hasCost = true
    }
    buckets.set(id, current)
  }
  return ORDER.flatMap((id) => {
    const group = buckets.get(id)
    return group ? [group] : []
  })
}

/** Generator, Solar and Grid always, so an empty day still shows the table.
 * IPP is included only when the branch has one. */
export function breakdownRows(usage: SourceUsage[]): GroupedSource[] {
  const grouped = new Map(groupSources(usage).map((group) => [group.id, group]))
  const blank = (id: SourceGroupId): GroupedSource => ({
    id,
    label: SOURCE_GROUP_LABEL[id],
    kwh: 0,
    naira: 0,
    hasCost: false,
  })
  const rows = (["generator", "solar", "grid"] as const).map(
    (id) => grouped.get(id) ?? blank(id)
  )
  const ipp = grouped.get("ipp")
  if (ipp) rows.push(ipp)
  return rows
}

/** ₦ per kWh from the grid bill. Null when the grid has no billed amount. */
export function gridRate(groups: GroupedSource[]) {
  const grid = groups.find((group) => group.id === "grid")
  if (!grid || grid.kwh <= 0 || !grid.hasCost) return null
  return grid.naira / grid.kwh
}

/** What the solar energy would have cost on the grid. */
export function avoidedCost(solarKwh: number, rate: number | null) {
  if (rate == null || !Number.isFinite(solarKwh)) return 0
  return solarKwh * rate
}

/** The daily email's projections: today's solar savings extended forward. */
export function projectedSavings(today: number, daysInMonth: number) {
  return {
    weekly: today * 7,
    monthly: today * daysInMonth,
    annual: today * 365,
  }
}
