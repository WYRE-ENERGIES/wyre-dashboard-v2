import type { EnergyConsumptionResponse } from "@/lib/api/parameters-types"
import {
  branchDevices,
  bucketize,
  deviceKey,
  filterParamDevices,
  periodBuckets,
  type Bucket,
} from "@/lib/parameters/series"
import { GRANULARITY, type Period } from "@/lib/period"

/**
 * Energy Consumption page rules (old mainAppPages/EnergyConsumption.js,
 * inventory 03 §5).
 */

export type SeriesDevice = { key: string; name: string; deviceType?: string }

export type EnergyRow = Bucket & Record<string, number | string>

/**
 * Previous / Current / Usage cards: each is the sum across the selected
 * devices (EnergyConsumption.js:79-81). Previous and Current are meter
 * readings at the start and end of the range; Usage is the difference.
 */
export function energyMeterTotals(
  devices: EnergyConsumptionResponse | undefined,
  selected: number[]
) {
  const list = filterParamDevices(branchDevices(devices), selected)
  const sum = (
    pick: (
      e: NonNullable<(typeof list)[number]["energy_consumption"]>
    ) => number | null | undefined
  ) =>
    list.reduce(
      (acc, d) =>
        acc + (d.energy_consumption ? (pick(d.energy_consumption) ?? 0) : 0),
      0
    )
  return {
    previous: sum((e) => e.previous),
    current: sum((e) => e.current),
    usage: sum((e) => e.usage),
    deviceCount: list.length,
  }
}

/**
 * kWh per bucket per device, summed into the period's granularity. One row per
 * bucket of the period (chart), plus `hasData` to drop empty buckets from the
 * table. Each row also carries `total` (all selected devices).
 */
export function energySeries(
  data: EnergyConsumptionResponse | undefined,
  selected: number[],
  period: Period
) {
  const granularity = GRANULARITY[period.kind]
  const devices = filterParamDevices(branchDevices(data), selected)
  const seriesDevices: SeriesDevice[] = devices.map((d, i) => ({
    key: deviceKey(d, i),
    name: d.name,
    deviceType: d.device_type,
  }))
  const perDevice = devices.map((d) =>
    bucketize(
      d.energy_consumption?.dates?.dates,
      d.energy_consumption?.energy_consumption_values?.value,
      granularity,
      "sum"
    )
  )
  const withData = new Set<string>()
  const rows: EnergyRow[] = periodBuckets(period).map((bucket) => {
    const row: EnergyRow = { ...bucket, total: 0 }
    seriesDevices.forEach((device, i) => {
      const value = perDevice[i].get(bucket.key)
      if (value !== undefined) withData.add(bucket.key)
      row[device.key] = value ?? 0
      row.total = (row.total as number) + (value ?? 0)
    })
    return row
  })
  return {
    devices: seriesDevices,
    rows,
    tableRows: rows.filter((row) => withData.has(row.key)),
  }
}

/**
 * Stacked or grouped bars (EnergyConsumptionBarChart.js:36-39): stacked when
 * nothing is selected (all devices) or more than 3 devices are selected;
 * grouped side by side for 1–3 selected devices, so they can be compared.
 */
export const isStacked = (selectedCount: number) =>
  selectedCount === 0 || selectedCount > 3
