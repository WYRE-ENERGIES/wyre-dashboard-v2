import {
  differenceInCalendarDays,
  format,
  getHours,
  startOfDay,
  startOfMonth,
  subHours,
  subMinutes,
} from "date-fns"

import type {
  EnergyConsumptionResponse,
  LastReadingDevice,
  LastReadingResponse,
  PhaseSeries,
  PowerDemandResponse,
  PowerQualityDevice,
  PowerQualityResponse,
  TimeOfUseBranch,
  TimeOfUseResponse,
} from "@/lib/api/parameters-types"
import {
  base,
  currentBranch,
  DEMO_BRANCHES,
  DEVICES,
  daysOf,
  dayKey,
  hourlyKwh,
  noise,
  wait,
} from "@/lib/demo"
import { GRANULARITY, periodEnd, type Period } from "@/lib/period"

/**
 * Demo data for the Parameters pages, shaped like the old app read the real
 * responses (see parameters-types.ts). Everything is derived from the same
 * hourly kWh model as the dashboard (`hourlyKwh`), so totals agree across
 * pages. Meters only log while their source is on, so off hours have no point.
 */

type Device = (typeof DEVICES)[number]
type Hour = { day: Date; hour: number; at: Date }

const iso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss")
const round = (n: number, digits = 2) =>
  Math.round(n * 10 ** digits) / 10 ** digits

/** Every hour of the period up to its end ("now" for the current period). */
function hoursOf(period: Period): Hour[] {
  const end = periodEnd(period).getTime()
  const hours: Hour[] = []
  for (const day of daysOf(period)) {
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(day.getTime() + hour * 3_600_000)
      if (at.getTime() > end) break
      hours.push({ day, hour, at })
    }
  }
  return hours
}

/** Groups hours into the period's buckets (hour, day or month). */
function groupHours(period: Period) {
  const granularity = GRANULARITY[period.kind]
  const groups = new Map<string, { at: Date; hours: Hour[] }>()
  for (const h of hoursOf(period)) {
    const at =
      granularity === "hourly"
        ? h.at
        : granularity === "daily"
          ? h.day
          : startOfMonth(h.day)
    const key = iso(at)
    const group = groups.get(key)
    if (group) group.hours.push(h)
    else groups.set(key, { at, hours: [h] })
  }
  return [...groups.values()]
}

const branchEnvelope = <T>(devices: T[]) => ({
  status: true,
  message: "Successful",
  authenticatedData: {
    id: currentBranch().id,
    name: currentBranch().name,
    devices,
  },
})

// Electrical model of each source.
const PROFILE: Record<
  string,
  { volts: number; pf: number; hz: number; hzSpread: number }
> = {
  UTILITY: { volts: 228, pf: 0.93, hz: 50, hzSpread: 0.3 },
  GENERATOR: { volts: 231, pf: 0.86, hz: 50, hzSpread: 0.8 },
  SOLAR: { volts: 230, pf: 0.98, hz: 50, hzSpread: 0.1 },
}
const profileOf = (d: Device) => PROFILE[d.device_type] ?? PROFILE.UTILITY

/** Meter readings at one moment, from the kW the source supplied that hour. */
function electrical(device: Device, kw: number, seed: number) {
  const p = profileOf(device)
  const n = (k: number) => noise(seed * 7 + k * 13 + device.device_id)
  const pf = round(Math.min(0.99, p.pf + (n(1) - 0.5) * 0.06), 3)
  const volts = [0, 1, 2].map((i) => round(p.volts + (n(2 + i) - 0.5) * 8, 1))
  // Phases are a little unbalanced.
  const split = [1 + (n(5) - 0.5) * 0.2, 1 + (n(6) - 0.5) * 0.2, 1]
  const sum = split.reduce((a, b) => a + b, 0)
  const phaseKw = split.map((s) => (kw * s) / sum)
  const amps = phaseKw.map((k, i) => round((k * 1000) / (volts[i] * pf), 1))
  const tan = Math.tan(Math.acos(pf))
  return {
    pf,
    hz: round(p.hz + (n(7) - 0.5) * p.hzSpread, 2),
    volts,
    amps,
    neutralAmps: round(
      Math.abs(amps[0] - amps[1]) * 0.6 + Math.abs(amps[1] - amps[2]) * 0.3,
      1
    ),
    activeKw: phaseKw.map((k) => round(k, 2)),
    reactiveKvar: phaseKw.map((k) => round(k * tan, 2)),
  }
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

/** Cumulative kWh on a source's meter at a date (so previous/current look real). */
function meterAt(device: Device, date: Date) {
  const start = 120_000 + (device.device_id - 100) * 37_000
  const daily = device.kw * currentBranch().scale * 7
  return round(
    start + differenceInCalendarDays(date, new Date(2024, 0, 1)) * daily,
    1
  )
}

function energyConsumption(period: Period) {
  const groups = groupHours(period)
  const hours = hoursOf(period)
  const start = hours[0]?.day ?? startOfDay(periodEnd(period))
  const devices = DEVICES.map((device) => {
    const values = groups.map((g) =>
      round(
        g.hours.reduce((acc, h) => acc + hourlyKwh(device, h.day, h.hour), 0),
        1
      )
    )
    const usage = round(
      values.reduce((a, b) => a + b, 0),
      1
    )
    const previous = meterAt(device, start)
    return {
      ...base(device),
      energy_consumption: {
        previous,
        current: round(previous + usage, 1),
        usage,
        dates: { dates: groups.map((g) => iso(g.at)), units: "" },
        energy_consumption_values: { value: values, units: "kWh" },
      },
    }
  })
  return wait<EnergyConsumptionResponse>(branchEnvelope(devices))
}

function powerQuality(period: Period) {
  const groups = groupHours(period)
  const devices = DEVICES.map((device): PowerQualityDevice => {
    const dates: string[] = []
    const series = {
      voltage: [[], [], [], []] as number[][],
      current: [[], [], [], []] as number[][],
      active_power: [[], [], [], []] as number[][],
      reactive_power: [[], [], [], []] as number[][],
    }
    const frequency: number[] = []
    const pf: number[] = []
    for (const g of groups) {
      const readings = g.hours
        .map((h) => ({ h, kw: hourlyKwh(device, h.day, h.hour) }))
        .filter((r) => r.kw > 0)
        .map((r) => electrical(device, r.kw, dayKey(r.h.day) * 24 + r.h.hour))
      if (!readings.length) continue
      dates.push(iso(g.at))
      const avg = (pick: (r: (typeof readings)[number]) => number) =>
        round(mean(readings.map(pick)), 2)
      for (let i = 0; i < 3; i++) {
        series.voltage[i].push(avg((r) => r.volts[i]))
        series.current[i].push(avg((r) => r.amps[i]))
        series.active_power[i].push(avg((r) => r.activeKw[i]))
        series.reactive_power[i].push(avg((r) => r.reactiveKvar[i]))
      }
      series.voltage[3].push(0)
      series.current[3].push(avg((r) => r.neutralAmps))
      series.active_power[3].push(0)
      series.reactive_power[3].push(0)
      frequency.push(avg((r) => r.hz))
      pf.push(round(mean(readings.map((r) => r.pf)), 3))
    }
    const phases = (lists: number[][], units: string): PhaseSeries => ({
      l1: lists[0],
      l2: lists[1],
      l3: lists[2],
      neutral: lists[3],
      units,
    })
    return {
      ...base(device),
      power_quality: {
        dates: { dates, units: "" },
        voltage: phases(series.voltage, "volts"),
        current: phases(series.current, "amps"),
        active_power: phases(series.active_power, "kW"),
        reactive_power: phases(series.reactive_power, "kVar"),
        frequency: { average: frequency, units: "hz" },
        power_factor: { l1_l2_l3: pf, units: "" },
      },
    }
  })
  return wait<PowerQualityResponse>(branchEnvelope(devices))
}

function powerDemand(period: Period) {
  const groups = groupHours(period)
  const devices = DEVICES.map((device) => {
    const dates: string[] = []
    const demand: number[] = []
    const min: number[] = []
    const max: number[] = []
    const avg: number[] = []
    for (const g of groups) {
      const hours = g.hours
        .map((h) => {
          const kw = hourlyKwh(device, h.day, h.hour)
          const seed = dayKey(h.day) * 24 + h.hour + device.device_id
          const kva = kw / profileOf(device).pf
          return {
            kva,
            min: kva * (0.6 + noise(seed * 3) * 0.2),
            max: kva * (1.15 + noise(seed * 5) * 0.3),
            avg: kva * (0.95 + noise(seed * 7) * 0.1),
          }
        })
        .filter((h) => h.kva > 0)
      if (!hours.length) continue
      dates.push(iso(g.at))
      demand.push(round(mean(hours.map((h) => h.kva))))
      min.push(round(Math.min(...hours.map((h) => h.min))))
      max.push(round(Math.max(...hours.map((h) => h.max))))
      avg.push(round(mean(hours.map((h) => h.avg))))
    }
    return {
      ...base(device),
      power_demand: {
        dates: { dates, units: "" },
        power_demand_values: { demand, min, max, avg, units: "kVA" },
      },
    }
  })
  return wait<PowerDemandResponse>(branchEnvelope(devices))
}

function lastReading(asOf: Date) {
  const devices = DEVICES.map((device): LastReadingDevice => {
    // The latest hour the source was on, up to 3 days back.
    let at = asOf
    let kw = 0
    for (let back = 0; back < 72; back++) {
      const t = subHours(asOf, back)
      kw = hourlyKwh(device, startOfDay(t), getHours(t))
      if (kw > 0) {
        at =
          back === 0
            ? t
            : new Date(
                startOfDay(t).getTime() + (getHours(t) + 1) * 3_600_000 - 60_000
              )
        break
      }
    }
    const seed = dayKey(at) * 24 + getHours(at)
    const readingAt = subMinutes(
      at,
      Math.round(1 + noise(seed + device.device_id) * 12)
    )
    const e = electrical(device, kw, seed)
    const activeKw = e.activeKw.reduce((a, b) => a + b, 0)
    const reactiveKvar = e.reactiveKvar.reduce((a, b) => a + b, 0)
    const kva = Math.sqrt(activeKw ** 2 + reactiveKvar ** 2)
    const n = (k: number) => noise(seed * 11 + k + device.device_id)
    const energy = meterAt(device, readingAt)
    const maxKw = device.kw * currentBranch().scale * (1.1 + n(1) * 0.3)
    return {
      ...base(device),
      last_reading: {
        date: iso(readingAt),
        data: {
          phase_measures: [
            {
              name: "voltage",
              l1: e.volts[0],
              l2: e.volts[1],
              l3: e.volts[2],
              unit: "volts",
            },
            {
              name: "current",
              l1: e.amps[0],
              l2: e.amps[1],
              l3: e.amps[2],
              unit: "amps",
            },
            {
              name: "active_power",
              l1: e.activeKw[0],
              l2: e.activeKw[1],
              l3: e.activeKw[2],
              unit: "kW",
            },
            {
              name: "reactive_power",
              l1: e.reactiveKvar[0],
              l2: e.reactiveKvar[1],
              l3: e.reactiveKvar[2],
              unit: "kVAR",
            },
            {
              name: "apparent_power",
              ...Object.fromEntries(
                e.activeKw.map((k, i) => [
                  `l${i + 1}`,
                  round(Math.hypot(k, e.reactiveKvar[i])),
                ])
              ),
              unit: "kVA",
            },
            {
              name: "pf",
              l1: e.pf,
              l2: round(e.pf - 0.01, 3),
              l3: round(e.pf + 0.005, 3),
              unit: "pf",
            },
          ],
          totals: [
            { name: "active_power", value: round(activeKw), unit: "kW" },
            {
              name: "reactive_power",
              value: round(reactiveKvar),
              unit: "kVAR",
            },
            { name: "apparent_power", value: round(kva), unit: "kVA" },
            { name: "frequency", value: e.hz, unit: "hz" },
            { name: "pf", value: e.pf, unit: "pf" },
            { name: "Neutral current", value: e.neutralAmps, unit: "A" },
          ],
          harmonic_distortion: [
            {
              name: "voltage_thd_ln",
              l1: round(1.5 + n(2) * 2),
              l2: round(1.5 + n(3) * 2),
              l3: round(1.5 + n(4) * 2),
              unit: "%",
            },
            {
              name: "current_thd",
              l1: round(4 + n(5) * 8),
              l2: round(4 + n(6) * 8),
              l3: round(4 + n(7) * 8),
              unit: "%",
            },
            {
              name: "current_tdd",
              l1: round(3 + n(8) * 6),
              l2: round(3 + n(9) * 6),
              l3: round(3 + n(10) * 6),
              unit: "%",
            },
          ],
          energy: [
            { name: "active_energy", value: energy, unit: "kWh" },
            {
              name: "active_energy_export",
              value: round(energy * 0.002, 1),
              unit: "kWh",
            },
            {
              name: "reactive_energy",
              value: round(energy * 0.38, 1),
              unit: "kvarh",
            },
            {
              name: "apparent_energy",
              value: round(energy * 1.08, 1),
              unit: "kvah",
            },
          ],
          demands: [
            {
              name: "max_amp",
              l1: round(e.amps[0] * 1.6 + 20),
              l2: round(e.amps[1] * 1.6 + 20),
              l3: round(e.amps[2] * 1.6 + 20),
              unit: "A",
            },
          ],
          total_demands: [
            { name: "max_power_demand", value: round(maxKw), unit: "kW" },
            {
              name: "accumulated_power_demand",
              value: round(activeKw * 0.97),
              unit: "kW",
            },
            {
              name: "max_kva_demand",
              value: round(maxKw / profileOf(device).pf),
              unit: "kVA",
            },
            { name: "kva_demand", value: round(kva), unit: "kVA" },
            { name: "power_demand", value: round(activeKw), unit: "kW" },
            {
              name: "accumulated_kva_demand",
              value: round(kva * 0.97),
              unit: "kVA",
            },
            { name: "pf_import_at_sliding_winow", value: e.pf, unit: "pf" },
          ],
        },
      },
    }
  })
  return wait<LastReadingResponse>(branchEnvelope(devices))
}

/** Whether a source is on in a given hour, per branch. The signed-in branch
 * uses the dashboard's model so hours match its Usage Hours card. */
function isOn(device: Device, h: Hour, branchId: number) {
  if (branchId === currentBranch().id)
    return hourlyKwh(device, h.day, h.hour) > 0
  const n = noise(
    dayKey(h.day) * 31 + h.hour * 7 + device.device_id + branchId * 1009
  )
  const daytime = h.hour >= 8 && h.hour < 18
  if (device.device_type === "UTILITY") return n > 0.3
  if (device.device_type === "GENERATOR")
    return n > (device.kw > 50 ? 0.6 : 0.8)
  return daytime
}

function timeOfUse(period: Period) {
  const hours = hoursOf(period)
  // Raw logs are hourly for a day or month; daily rows keep a year readable.
  const daily = period.kind === "year"
  const branches: TimeOfUseBranch[] = DEMO_BRANCHES.map((branch) => {
    const onHours = new Map<number, number>()
    const rows = new Map<string, Record<string, string | number>>()
    const cumulative = new Map<number, number>()
    for (const h of hours) {
      const key = iso(daily ? h.day : h.at)
      const row = rows.get(key) ?? { post_datetime: key }
      for (const device of DEVICES) {
        const on = isOn(device, h, branch.id)
        const add = on ? 1 : 0
        onHours.set(
          device.device_id,
          (onHours.get(device.device_id) ?? 0) + add
        )
        cumulative.set(
          device.device_id,
          (cumulative.get(device.device_id) ?? 0) + add
        )
        const prevHours =
          (row[`${device.name}_hours`] as number | undefined) ?? 0
        row[device.name] = on || row[device.name] === "ON" ? "ON" : "OFF"
        row[`${device.name}_hours`] = prevHours + add
        row[`${device.name}_hou_cummulative`] =
          cumulative.get(device.device_id) ?? 0
      }
      rows.set(key, row)
    }
    return {
      id: branch.id,
      branch_id: branch.id,
      name: branch.name,
      devices: DEVICES.map(base),
      usage_hours: {
        devices: DEVICES.map((d) => d.name),
        hours: DEVICES.map((d) => onHours.get(d.device_id) ?? 0),
      },
      time_of_use_table: {
        titles: [
          "post_datetime",
          ...DEVICES.flatMap((d) => [
            d.name,
            `${d.name}_hours`,
            `${d.name}_hou_cummulative`,
          ]),
        ],
        values: [...rows.values()],
        sums: Object.fromEntries(
          DEVICES.map((d) => [d.name, onHours.get(d.device_id) ?? 0])
        ),
      },
    }
  })
  return wait<TimeOfUseResponse>({
    status: true,
    message: "Successful",
    authenticatedData: { id: 1, name: "Demo Retail Ltd", branches },
  })
}

export const demoParameters = {
  energyConsumption,
  powerQuality,
  powerDemand,
  lastReading,
  timeOfUse,
}
