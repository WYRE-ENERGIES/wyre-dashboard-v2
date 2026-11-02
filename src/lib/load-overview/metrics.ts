import type {
  LoadOverviewDevice,
  LoadOverviewResponse,
} from "@/lib/api/load-overview"
import type { BranchDemandResponse } from "@/lib/api/types"

/**
 * Load Overview rules, ported from the old helpers (genericHelpers.js:780-818,
 * LoadOverview.js:51-143; inventory 03 §6):
 * - Building energy = Σ consumption of `is_source` devices (generateSumOfIsSource).
 * - Load consumption = Σ consumption of `is_load` devices (generateSumLoadConsumption).
 * - Percentage load = load ÷ building × 100, 0 when building is 0
 *   (calculatePercentageTwoDecimal).
 * - Demand rows are matched to loads by `device_name === name`.
 *
 * Unlike the old page, the global device filter applies to the loads. Building
 * energy always counts every source meter, since it is the denominator.
 */

export type LoadRow = {
  key: string
  name: string
  kwh: number
  runtimeHours: number
  /** Share of all (filtered) load consumption, 0–100. */
  shareOfLoads: number
  /** Share of building energy, 0–100. */
  shareOfBuilding: number
  demand: { max: number; avg: number; min: number; unit: string } | null
}

const n = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0

/** Selected device ids from the global filter; load_overview devices may
 * lack `device_id`, so names of the selected side-bar devices match too. */
export function inSelection(
  device: LoadOverviewDevice,
  selectedIds: number[],
  selectedNames: string[]
) {
  if (!selectedIds.length) return true
  if (device.device_id !== undefined)
    return selectedIds.includes(device.device_id)
  return selectedNames.includes(device.name)
}

export function loadOverview(
  data: LoadOverviewResponse | undefined,
  demand: BranchDemandResponse | undefined,
  selectedIds: number[],
  selectedNames: string[]
) {
  const devices = data?.authenticatedData.branches[0]?.devices ?? []
  const allLoads = devices.filter((d) => d.is_load)
  const loads = allLoads.filter((d) =>
    inSelection(d, selectedIds, selectedNames)
  )
  const buildingKwh = devices
    .filter((d) => d.is_source)
    .reduce((acc, d) => acc + n(d.consumption), 0)
  const loadKwh = loads.reduce((acc, d) => acc + n(d.consumption), 0)
  const demands = demand?.data[0]?.devices_demands ?? []
  const unit = demand?.data[0]?.unit ?? "kVA"

  const rows: LoadRow[] = loads
    .map((d, index) => {
      const match = demands.find((x) => x.device_name === d.name)
      return {
        key: `l${d.device_id ?? d.id ?? index}`,
        name: d.name,
        kwh: n(d.consumption),
        runtimeHours: n(d.device_runtime),
        shareOfLoads: loadKwh ? (n(d.consumption) / loadKwh) * 100 : 0,
        shareOfBuilding: buildingKwh
          ? (n(d.consumption) / buildingKwh) * 100
          : 0,
        demand: match
          ? {
              max: n(match.max),
              avg: n(match.avg),
              min: n(match.min),
              unit: match.unit || unit,
            }
          : null,
      }
    })
    .sort((a, b) => b.kwh - a.kwh)

  return {
    hasLoadMeters: allLoads.length > 0,
    buildingKwh,
    loadKwh,
    percentLoad: buildingKwh
      ? Math.round((loadKwh / buildingKwh) * 10_000) / 100
      : 0,
    rows,
  }
}

/** Loads take the chart palette in its fixed order (purple, cyan, yellow,
 * blue, coral); past five, lighter tints of the same order. */
const LOAD_ORDER = [1, 2, 5, 3, 4]

export function loadColor(index: number) {
  const shade = `var(--chart-${LOAD_ORDER[index % LOAD_ORDER.length]})`
  return index < LOAD_ORDER.length
    ? shade
    : `color-mix(in oklch, ${shade} 50%, var(--background))`
}
