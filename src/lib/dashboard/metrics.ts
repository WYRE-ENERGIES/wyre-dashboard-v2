import { format, parseISO } from "date-fns"

import type {
  BranchDemandResponse,
  DailyConsumptionResponse,
  DeviceBase,
  DeviceUsageResponse,
  TotalEnergyResponse,
} from "@/lib/api/types"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Dashboard business rules, ported from the old app's helpers (inventory
 * 02 §1.4 and §8). Each rule notes where it came from.
 */

/** Keep only the devices ticked in the global device filter (none = all).
 * Old: helpers/v2/organizationDataHelpers.js `devicesArray`. */
export function filterDevices<T extends DeviceBase>(devices: T[], selected: number[]) {
  return selected.length ? devices.filter((d) => selected.includes(d.device_id)) : devices
}

const isAggregatorySource = (d: DeviceBase) => d.is_source && d.source_tag === "AGGREGATORY"

/** Total Energy card. Totals add up AGGREGATORY sources only (cards/TotalEnergy.js). */
export function totalEnergy(data: TotalEnergyResponse | undefined, selected: number[]) {
  const devices = filterDevices(data?.authenticatedData.branches[0]?.devices ?? [], selected)
  const sources = devices.filter(isAggregatorySource)
  const sum = (pick: (d: (typeof devices)[number]) => number | null) =>
    sources.reduce((acc, d) => acc + (pick(d) ?? 0), 0)
  return {
    totalKwh: sum((d) => d.dashboard.total_kwh.value),
    // "Solar hours" = energy used between 8am and 6pm, not solar output.
    solarHoursKwh: sum((d) => d.dashboard.solar_hours.value),
    // Carbon and today/yesterday add up *all* filtered devices
    // (cards/CarbonEmmission.js, cards/YesterdayAndToday.js).
    carbonTons: devices.reduce((acc, d) => acc + (d.dashboard.dashboard_carbon_emissions.value ?? 0), 0),
    todayKwh: devices.reduce((acc, d) => acc + (d.dashboard.today.value ?? 0), 0),
    yesterdayKwh: devices.reduce((acc, d) => acc + (d.dashboard.yesterday.value ?? 0), 0),
  }
}

/**
 * Demand card (helpers/genericHelpers.js `calculateDemandMinMaxAvgValues`):
 * max = max of device maxima; avg = max of device averages (intended, decision
 * #5); min = mean of non-zero device minima. Unit kVA.
 * The old card ignored the device filter; this one respects it (decision #1).
 */
export function demandSummary(
  data: BranchDemandResponse | undefined,
  selectedNames: string[] | null
) {
  const all = data?.data[0]?.devices_demands ?? []
  const devices = selectedNames ? all.filter((d) => selectedNames.includes(d.device_name)) : all
  const mins = devices.map((d) => d.min).filter((v) => v > 0)
  return {
    max: devices.length ? Math.max(...devices.map((d) => d.max)) : 0,
    avg: devices.length ? Math.max(...devices.map((d) => d.avg)) : 0,
    min: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : 0,
  }
}

export type SourceUsage = {
  deviceId: number
  name: string
  deviceType: string
  kwh: number
  hours: number
  naira: number | null
}

/** Per-source cards and the usage-hours doughnut (DashBoardAmountUsed.js). */
export function sourceUsage(data: DeviceUsageResponse | undefined, selected: number[]): SourceUsage[] {
  return filterDevices(data?.authenticatedData.branches[0]?.devices ?? [], selected)
    .filter((d) => d.is_source)
    .map((d) => ({
      deviceId: d.device_id,
      name: d.name,
      deviceType: d.device_type,
      kwh: d.energy_consumption.usage,
      hours: d.usage_hours,
      naira: d.billing_totals?.present_total.value_naira ?? null,
    }))
}

export type EnergySeries = {
  /** One entry per time bucket, keyed by device id. */
  rows: Array<{ label: string; tooltipLabel: string } & Record<string, number | string>>
  devices: Array<{ key: string; name: string; deviceType: string }>
}

/**
 * Energy-by-source chart, at the granularity the period dictates:
 * - Day → hourly, from device_usage (which honours the interval);
 * - Month → daily, from daily_consumption;
 * - Year → monthly, summing daily_consumption by month, because that endpoint
 *   always returns daily points (proposal E7 in the inventory).
 */
export function energySeries(
  period: Period,
  usage: DeviceUsageResponse | undefined,
  daily: DailyConsumptionResponse | undefined,
  selected: number[]
): EnergySeries {
  if (period.kind === "day") {
    const sources = filterDevices(usage?.authenticatedData.branches[0]?.devices ?? [], selected).filter(
      (d) => d.is_source
    )
    const rows = Array.from({ length: 24 }, (_, hour) => {
      const label = `${String(hour).padStart(2, "0")}:00`
      return { label, tooltipLabel: label } as EnergySeries["rows"][number]
    })
    for (const device of sources) {
      const { dates } = device.energy_consumption.dates
      const values = device.energy_consumption.energy_consumption_values.value
      for (const row of rows) row[key(device)] = 0
      dates.forEach((iso, i) => {
        const hour = parseISO(iso).getHours()
        rows[hour][key(device)] = (rows[hour][key(device)] as number) + (values[i] ?? 0)
      })
    }
    return { rows, devices: sources.map((d) => ({ key: key(d), name: d.name, deviceType: d.device_type })) }
  }

  const branch = daily?.authenticatedData.branches[0]
  const sources = filterDevices(branch?.devices ?? [], selected).filter((d) => d.is_source)
  const start = format(periodStart(period), "yyyy-MM-dd")
  const end = format(periodEnd(period), "yyyy-MM-dd")
  // The endpoint returns one day past the end; keep only days inside the period.
  const days = (branch?.dates ?? [])
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => date >= start && date <= end)

  if (period.kind === "month") {
    const rows = days.map(({ date, index }) => {
      const row = {
        label: format(parseISO(date), "d"),
        tooltipLabel: format(parseISO(date), "EEE d MMM"),
      } as EnergySeries["rows"][number]
      for (const device of sources) row[key(device)] = device.daily_kwh[index] ?? 0
      return row
    })
    return { rows, devices: sources.map((d) => ({ key: key(d), name: d.name, deviceType: d.device_type })) }
  }

  const year = periodStart(period).getFullYear()
  const rows = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1)
    const row = {
      label: format(date, "MMM"),
      tooltipLabel: format(date, "MMMM yyyy"),
    } as EnergySeries["rows"][number]
    for (const device of sources) row[key(device)] = 0
    return row
  })
  for (const { date, index } of days) {
    const month = parseISO(date).getMonth()
    for (const device of sources) {
      rows[month][key(device)] = (rows[month][key(device)] as number) + (device.daily_kwh[index] ?? 0)
    }
  }
  return { rows, devices: sources.map((d) => ({ key: key(d), name: d.name, deviceType: d.device_type })) }
}

const key = (d: DeviceBase) => `d${d.device_id}`

/**
 * Load Overview block for BESPOKE clients (genericHelpers.js
 * `generateLoadOverviewChartData`): each load device's share of total load kWh.
 */
export function loadShares(data: TotalEnergyResponse | undefined, selected: number[]) {
  const loads = filterDevices(data?.authenticatedData.branches[0]?.devices ?? [], selected).filter(
    (d) => d.is_load
  )
  const total = loads.reduce((acc, d) => acc + (d.dashboard.total_kwh.value ?? 0), 0)
  return loads.map((d) => ({
    name: d.name,
    kwh: d.dashboard.total_kwh.value ?? 0,
    percent: total ? ((d.dashboard.total_kwh.value ?? 0) / total) * 100 : 0,
  }))
}
