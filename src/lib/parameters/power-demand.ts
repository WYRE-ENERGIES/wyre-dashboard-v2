import type { PowerDemandResponse } from "@/lib/api/parameters-types"
import {
  branchDevices,
  bucketize,
  deviceKey,
  displayUnit,
  filterParamDevices,
  periodBuckets,
  type Bucket,
} from "@/lib/parameters/series"
import type { SeriesDevice } from "@/lib/parameters/energy-consumption"
import { GRANULARITY, type Period } from "@/lib/period"

/**
 * Power Demand page rules (old mainAppPages/PowerDemand.js, inventory 03 §3).
 *
 * Old defects fixed here:
 * - Max and Avg columns were swapped (headings min,max,avg vs values
 *   min,avg,max): each value is now read by name.
 * - Source was blank (rows never carried the device name).
 * - The unit read `.units` off the array, so it was always "undefined"; it now
 *   comes from each device's `power_demand_values.units`.
 */

export type DemandRow = Bucket & {
  rowId: string
  deviceKey: string
  source: string
  unit: string
  demand: number | null
  min: number | null
  max: number | null
  avg: number | null
}

export type DemandChartRow = Bucket & Record<string, number | string>

/** Demand is reported in kW by the captured payload; kVA on some meters. */
const FALLBACK_UNIT = "kW"

export function demandData(
  data: PowerDemandResponse | undefined,
  selected: number[],
  period: Period
) {
  const granularity = GRANULARITY[period.kind]
  const buckets = periodBuckets(period)
  const devices = filterParamDevices(branchDevices(data), selected)

  const perDevice = devices.map((device, index) => {
    const values = device.power_demand?.power_demand_values
    const dates = device.power_demand?.dates?.dates
    // Folding finer points into a bucket: lowest min, highest max, mean of
    // averages; the plotted demand is the bucket's mean demand.
    const avg = bucketize(dates, values?.avg, granularity, "mean")
    const demand = bucketize(dates, values?.demand, granularity, "mean")
    return {
      key: deviceKey(device, index),
      name: device.name,
      deviceType: device.device_type,
      unit: displayUnit(values?.units, FALLBACK_UNIT),
      // In the captured payload `demand` equals `avg`; plot avg when a
      // device sends no demand series, so the chart is never empty while the
      // table has data (the old chart stayed empty live).
      demand: demand.size ? demand : avg,
      min: bucketize(dates, values?.min, granularity, "min"),
      max: bucketize(dates, values?.max, granularity, "max"),
      avg,
    }
  })

  const seriesDevices: SeriesDevice[] = perDevice.map(
    ({ key, name, deviceType }) => ({ key, name, deviceType })
  )
  const units = [...new Set(perDevice.map((d) => d.unit))]

  const chartRows: DemandChartRow[] = buckets.map((bucket) => {
    const row: DemandChartRow = { ...bucket }
    for (const d of perDevice) row[d.key] = d.demand.get(bucket.key) ?? 0
    return row
  })

  // Table: one row per bucket per device, by time then device order.
  const tableRows: DemandRow[] = []
  for (const bucket of buckets) {
    for (const d of perDevice) {
      const pick = (map: Map<string, number>) => map.get(bucket.key) ?? null
      const row = {
        ...bucket,
        rowId: `${bucket.key}-${d.key}`,
        deviceKey: d.key,
        source: d.name,
        unit: d.unit,
        demand: pick(d.demand),
        min: pick(d.min),
        max: pick(d.max),
        avg: pick(d.avg),
      }
      if ([row.demand, row.min, row.max, row.avg].some((v) => v !== null))
        tableRows.push(row)
    }
  }

  return {
    devices: seriesDevices,
    chartRows,
    tableRows,
    /** One unit for every device (normally), else null and the table shows a Unit column. */
    unit: units.length === 1 ? units[0] : null,
    units,
  }
}
