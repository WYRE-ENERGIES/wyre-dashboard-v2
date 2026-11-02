import {
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
} from "date-fns"

import type {
  RawBatteryPlot,
  RawConsumptionPlot,
  RawPvPlot,
  RawSolarLive,
  RawSolarOverview,
  RawSolarYield,
  SolarDate,
} from "@/lib/api/solar-types"
import {
  currentBranch,
  dayKey,
  DEVICES,
  hourlyKwh,
  noise,
  wait,
} from "@/lib/demo"

/**
 * Demo Solar Overview data, built on the demo branch's devices so it agrees
 * with the dashboard: PV output is exactly the Solar_Inverter's hourly kWh
 * (daylight only, 08:00–18:00), grid is UTILITY and generators are the two
 * GEN sets. A small battery charges from PV around midday and discharges in
 * the evening and overnight; the load is what all of that supplies.
 */

const SOLAR = DEVICES.find((d) => d.device_type === "SOLAR")!
const UTILITY = DEVICES.find((d) => d.device_type === "UTILITY")!
const GENERATORS = DEVICES.filter((d) => d.device_type === "GENERATOR")

/** Tracking start for "all time" totals. */
const SINCE = new Date(2025, 2, 1)
/** ₦ per kWh used to value solar, grid and load energy. */
const TARIFF = 209
const MIN_SOC = 0.2

const scale = () => currentBranch().scale
const installedKwp = () => Math.round(12 * scale() * 10) / 10
const batteryKwh = () => Math.round(20 * scale())

type Hour = {
  hour: number
  pv: number
  grid: number
  gen: number
  charge: number
  discharge: number
  soc: number
  load: number
}

const cache = new Map<string, Hour[]>()

/** One day, hour by hour. Deterministic, so every view agrees. */
function simulateDay(day: Date, carryOver = true): Hour[] {
  const key = `${currentBranch().id}:${dayKey(day)}:${carryOver}`
  const hit = cache.get(key)
  if (hit) return hit
  const capacity = batteryKwh()
  // Start from where yesterday ended (one day back is enough to keep charge
  // and discharge in balance over a month).
  const yesterday = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() - 1
  )
  let stored = carryOver
    ? (simulateDay(yesterday, false)[23].soc / 100) * capacity
    : capacity * (0.4 + noise(dayKey(day)) * 0.1)
  const hours: Hour[] = []
  for (let hour = 0; hour < 24; hour++) {
    const pv = hourlyKwh(SOLAR, day, hour)
    const grid = hourlyKwh(UTILITY, day, hour)
    const gen = GENERATORS.reduce((a, g) => a + hourlyKwh(g, day, hour), 0)
    let charge = 0
    let discharge = 0
    if (hour >= 10 && hour < 16 && pv > 0) {
      // Midday surplus tops the battery up.
      charge = Math.min(pv * 0.45, capacity - stored)
    } else if (hour >= 18 || hour < 6) {
      // Evening peak, then a trickle overnight, down to the SOC floor.
      const want = (hour >= 18 ? 2.2 : 0.6) * scale()
      discharge = Math.max(0, Math.min(want, stored - capacity * MIN_SOC))
    }
    stored += charge - discharge
    const r = (v: number) => Math.round(v * 100) / 100
    hours.push({
      hour,
      pv: r(pv),
      grid: r(grid),
      gen: r(gen),
      charge: r(charge),
      discharge: r(discharge),
      soc: Math.round((stored / capacity) * 1000) / 10,
      load: r(pv - charge + discharge + grid + gen),
    })
  }
  cache.set(key, hours)
  return hours
}

/** Hours of a day that have happened (all of them for past days). */
function elapsedHours(day: Date, now = new Date()) {
  const hours = simulateDay(day)
  if (isAfter(startOfDay(day), now)) return []
  if (format(day, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd")) return hours
  return hours.filter((h) => h.hour <= now.getHours())
}

type Stamped = Hour & { at: Date }

function hoursBetween(start: Date, end: Date): Stamped[] {
  const out: Stamped[] = []
  const now = new Date()
  for (
    let d = startOfDay(start);
    !isAfter(d, end) && !isAfter(d, now);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    for (const h of elapsedHours(d, now))
      out.push({
        ...h,
        at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h.hour),
      })
  }
  return out
}

const sum = (hours: Stamped[], pick: (h: Stamped) => number) =>
  hours.reduce((a, h) => a + pick(h), 0)
const round = (n: number, digits = 2) =>
  Math.round(n * 10 ** digits) / 10 ** digits

function bucket(hours: Stamped[], timeOnly: boolean) {
  const energy = (pick: (h: Stamped) => number) => {
    const kwh = sum(hours, pick)
    return { kwh: round(kwh, 1), cost: round(kwh * TARIFF, 0) }
  }
  const loads = hours.filter((h) => h.load > 0)
  const max = loads.reduce<Stamped | null>(
    (a, h) => (!a || h.load > a.load ? h : a),
    null
  )
  const min = loads.reduce<Stamped | null>(
    (a, h) => (!a || h.load < a.load ? h : a),
    null
  )
  const at = (h: Stamped | null) =>
    h ? format(h.at, timeOnly ? "HH:mm" : "yyyy-MM-dd'T'HH:mm:ss") : null
  return {
    generation: energy((h) => h.pv),
    load: energy((h) => h.load),
    grid: energy((h) => h.grid),
    battery: {
      charge_kwh: round(
        sum(hours, (h) => h.charge),
        1
      ),
      charge_cost: round(sum(hours, (h) => h.charge) * TARIFF, 0),
      discharge_kwh: round(
        sum(hours, (h) => h.discharge),
        1
      ),
      discharge_cost: round(sum(hours, (h) => h.discharge) * TARIFF, 0),
    },
    power_demand: {
      max_kw: round(max?.load ?? 0, 3),
      max_at: at(max),
      min_kw: round(min?.load ?? 0, 3),
      min_at: at(min),
      avg_kw: round(
        loads.length ? sum(loads, (h) => h.load) / loads.length : 0,
        3
      ),
    },
  }
}

function yieldResponse(date?: SolarDate): RawSolarYield {
  const now = new Date()
  if (date) {
    const start = new Date(date.year, date.month - 1, date.day ?? 1)
    const end = date.day !== undefined ? endOfDay(start) : endOfMonth(start)
    const b = bucket(hoursBetween(start, end), date.day !== undefined)
    return {
      filter: { year: date.year, month: date.month, day: date.day ?? null },
      generation: { total: b.generation },
      load: { total: b.load },
      grid: { total: b.grid },
      battery: { total: b.battery },
      power_demand: { total: b.power_demand },
    }
  }
  const total = bucket(hoursBetween(SINCE, now), false)
  const today = bucket(hoursBetween(startOfDay(now), now), true)
  const monthly = bucket(hoursBetween(startOfMonth(now), now), false)
  const pick = <K extends keyof typeof total>(k: K) => ({
    total: total[k],
    today: today[k],
    monthly: monthly[k],
  })
  return {
    filter: null,
    generation: pick("generation"),
    load: pick("load"),
    grid: pick("grid"),
    battery: { ...pick("battery"), since: format(SINCE, "yyyy-MM-dd") },
    power_demand: pick("power_demand"),
  }
}

const dayOf = ({ year, month, day }: Required<SolarDate>) =>
  new Date(year, month - 1, day)
const label = (hour: number) => `${String(hour).padStart(2, "0")}:00`

export const demoSolar = {
  overview: () => {
    const now = new Date()
    const branch = currentBranch()
    const n = noise(dayKey(now) + branch.id)
    return wait<{ data: RawSolarOverview }>({
      data: {
        weather: {
          city: branch.name.startsWith("Abuja")
            ? "Abuja"
            : `${branch.name.replace(" Branch", "")}, Lagos`,
          condition: n > 0.66 ? "Cloudy" : n > 0.33 ? "Partly cloudy" : "Sunny",
          temperature_c: Math.round(28 + n * 5),
          sunshine: "06:48 – 18:52",
        },
      },
    })
  },

  live: () => {
    const now = new Date()
    const h = simulateDay(now)[now.getHours()]
    // Wobble the hour's average a little per 5-minute poll.
    const n = noise(
      dayKey(now) * 100 + now.getHours() * 12 + Math.floor(now.getMinutes() / 5)
    )
    const k = (v: number) => round(v * (0.9 + n * 0.2), 3)
    const pv = k(h.pv)
    const batteryKw = k(h.discharge - h.charge)
    const capacity = installedKwp()
    return wait<{ data: RawSolarLive }>({
      data: {
        pv: {
          kw: pv,
          installed_capacity_kwp: capacity,
          percentage: Math.round(Math.min(100, (pv / capacity) * 100)),
          direction: pv > 0 ? "OUT" : "IDLE",
        },
        battery: {
          kw: batteryKw,
          percentage: Math.round(h.soc),
          direction: batteryKw > 0 ? "OUT" : batteryKw < 0 ? "IN" : "IDLE",
          installed_battery_capacity_kwh: batteryKwh(),
        },
        grid: {
          kw: k(h.grid),
          direction: h.grid > 0 ? "OUT" : "IDLE",
          status: h.grid > 0 ? "ON" : "OFF",
        },
        load: { kw: k(h.load), direction: h.load > 0 ? "IN" : "IDLE" },
        generator_power: {
          kw: k(h.gen),
          direction: h.gen > 0 ? "OUT" : "IDLE",
          status: h.gen > 0 ? "ON" : "OFF",
        },
        overlay: { is_overlay: false, message: null },
        refresh_interval_seconds: 300,
      },
    })
  },

  yield: (date?: SolarDate) => wait({ data: yieldResponse(date) }),

  consumptionPlot: (date: Required<SolarDate>) => {
    const hours = elapsedHours(dayOf(date))
    return wait<{ data: RawConsumptionPlot }>({
      data: {
        hours: hours.map((h) => ({
          hour_label: label(h.hour),
          pv_kw: h.pv,
          grid_kw: h.grid,
          load_kw: h.load,
        })),
        total_production_kwh: round(
          hours.reduce((a, h) => a + h.pv, 0),
          1
        ),
        total_consumption_kwh: round(
          hours.reduce((a, h) => a + h.load, 0),
          1
        ),
      },
    })
  },

  pvPlot: (date: Required<SolarDate>) => {
    const hours = elapsedHours(dayOf(date))
    const peak = hours.reduce<Hour | null>(
      (a, h) => (!a || h.pv > a.pv ? h : a),
      null
    )
    return wait<{ data: RawPvPlot }>({
      data: {
        hours: hours.map((h) => ({ hour_label: label(h.hour), pv_kw: h.pv })),
        daily_total_production_kwh: round(
          hours.reduce((a, h) => a + h.pv, 0),
          1
        ),
        peak_daily_production_kw: peak?.pv ?? 0,
        peak_daily_production_at: peak && peak.pv > 0 ? label(peak.hour) : null,
      },
    })
  },

  batteryPlot: (date: Required<SolarDate>) => {
    const hours = elapsedHours(dayOf(date))
    return wait<{ data: RawBatteryPlot }>({
      data: {
        hours: hours.map((h) => ({
          hour_label: label(h.hour),
          battery_charge_kW: h.charge,
          battery_discharge_kW: h.discharge,
          soc_pct: h.soc,
        })),
        total_battery_charge_kW: round(
          hours.reduce((a, h) => a + h.charge, 0),
          1
        ),
        total_battery_discharge_kW: round(
          hours.reduce((a, h) => a + h.discharge, 0),
          1
        ),
      },
    })
  },
}
