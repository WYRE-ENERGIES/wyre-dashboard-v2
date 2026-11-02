import { format, formatDistanceToNowStrict, getDaysInMonth } from "date-fns"

import type {
  RawCo2,
  RawCostMetrics,
  RawDieselPrice,
  RawEnergyFuelSeries,
  RawFuelUsageSeries,
  RawGeneratorMetrics,
  RawGeneratorsStatus,
  RawMonthlyEnergy,
  RawRuntimeFuel,
  MonthYear,
} from "@/lib/api/diesel-types"
import { daysOf, DEVICES, hourlyKwh, noise, wait } from "@/lib/demo"
import { periodEnd, type Period } from "@/lib/period"

/**
 * Demo Diesel Overview data, in the raw API shapes, derived from the same
 * hourly generator output the demo dashboard uses (GEN_275kVA, GEN_65kVA), so
 * totals agree across pages.
 */

const GENERATORS = DEVICES.filter((d) => d.device_type === "GENERATOR")
type Gen = (typeof GENERATORS)[number]

const PRICE_PER_LITRE = 1250
/** kWh per litre at typical load: the big set runs more efficiently. */
const EFFICIENCY: Record<string, number> = { GEN_275kVA: 3.6, GEN_65kVA: 2.9 }
const POWER_FACTOR = 0.85

const monthPeriod = ({ month, year }: MonthYear): Period => ({
  kind: "month",
  anchor: new Date(year, month - 1, 1),
})

/** Each elapsed hour of the month with that generator's kWh. */
function hours(gen: Gen, my: MonthYear) {
  const period = monthPeriod(my)
  const end = periodEnd(period).getTime()
  if (period.anchor.getTime() > Date.now()) return []
  const out: Array<{ day: Date; hour: number; kwh: number }> = []
  for (const day of daysOf(period)) {
    for (let hour = 0; hour < 24; hour++) {
      if (day.getTime() + hour * 3_600_000 > end) break
      out.push({ day, hour, kwh: hourlyKwh(gen, day, hour) })
    }
  }
  return out
}

const litres = (gen: Gen, kwh: number) => kwh / (EFFICIENCY[gen.name] ?? 3.2)
const round = (n: number, digits = 2) =>
  Math.round(n * 10 ** digits) / 10 ** digits

function monthTotals(my: MonthYear) {
  return GENERATORS.map((gen) => {
    const h = hours(gen, my)
    const kwh = h.reduce((a, x) => a + x.kwh, 0)
    const running = h.filter((x) => x.kwh > 0)
    return {
      gen,
      kwh,
      fuel: litres(gen, kwh),
      runHours: running.length,
      running,
    }
  })
}

function dailySeries(gen: Gen, my: MonthYear) {
  const byDay = new Map<string, number>()
  for (const { day, kwh } of hours(gen, my)) {
    const key = format(day, "yyyy-MM-dd")
    byDay.set(key, (byDay.get(key) ?? 0) + kwh)
  }
  return [...byDay].map(([date, kwh]) => ({
    date,
    kwh: round(kwh, 1),
    fuel_liters: round(litres(gen, kwh), 1),
  }))
}

function metrics(my: MonthYear): RawGeneratorMetrics {
  const totals = monthTotals(my)
  const kwh = totals.reduce((a, t) => a + t.kwh, 0)
  const fuel = totals.reduce((a, t) => a + t.fuel, 0)
  const running = totals.flatMap((t) =>
    t.running.map((r) => r.kwh / POWER_FACTOR)
  )
  // Hourly kWh is the hour's average kW; peaks within the hour run higher and
  // troughs lower, so max ≥ avg ≥ min always holds here.
  const avg = running.length
    ? running.reduce((a, b) => a + b, 0) / running.length
    : 0
  const max = running.length ? Math.max(...running) * 1.12 : 0
  const min = running.length ? Math.min(...running) * 0.85 : 0
  const efficiency = fuel ? kwh / fuel : 0
  return {
    fuel_efficiency: { value: round(efficiency), unit: "kWh/L" },
    // The old card divides this by 1000 to show L/kWh.
    fuel_consumption: {
      value: round(efficiency ? 1000 / efficiency : 0),
      unit: "mL/kWh",
    },
    power_demand_kva: {
      max: { value: round(max), unit: "kVA" },
      avg: { value: round(avg), unit: "kVA" },
      min: { value: round(min), unit: "kVA" },
    },
    generator_efficiency_score: {
      value: round(Math.min(100, (efficiency / 4) * 100), 1),
      unit: "%",
    },
  }
}

function cost(my: MonthYear): RawCostMetrics {
  const totals = monthTotals(my)
  const kwh = totals.reduce((a, t) => a + t.kwh, 0)
  const fuel = totals.reduce((a, t) => a + t.fuel, 0)
  const total = fuel * PRICE_PER_LITRE
  const days = Math.max(1, daysOf(monthPeriod(my)).length)
  return {
    total_cost: { value: round(total), unit: "NGN" },
    blended_cost: { value: round(kwh ? total / kwh : 0), unit: "NGN/kWh" },
    annual_cost_forecast: { value: round((total / days) * 365), unit: "NGN" },
  }
}

const thisMonth = (): MonthYear => ({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
})

export const demoDiesel = {
  generatorsStatus: () => {
    const now = new Date()
    return wait<RawGeneratorsStatus>({
      generators: GENERATORS.map((gen) => {
        const on = hourlyKwh(gen, now, now.getHours()) > 0
        // Walk back to the last hour this generator ran.
        let last = new Date(now)
        for (let back = 1; back < 24 * 14 && !on; back++) {
          const t = new Date(now.getTime() - back * 3_600_000)
          if (hourlyKwh(gen, t, t.getHours()) > 0) {
            last = t
            break
          }
        }
        return {
          device_id: gen.device_id,
          name: gen.name,
          is_currently_on: on,
          last_usage_time_relative: on
            ? "just now"
            : `${formatDistanceToNowStrict(last)} ago`,
        }
      }),
    })
  },

  dieselPrice: () => {
    const my = thisMonth()
    const c = cost(my)
    const m = metrics(my)
    const elapsed = Math.max(1, daysOf(monthPeriod(my)).length)
    const days = getDaysInMonth(new Date())
    return wait<{ data: RawDieselPrice }>({
      data: {
        diesel_price_per_litre: PRICE_PER_LITRE,
        diesel_efficiency: m.fuel_efficiency?.value ?? 0,
        month_estimated_cost: round(
          ((c.total_cost?.value ?? 0) / elapsed) * days
        ),
      },
    })
  },

  co2: (my: MonthYear) =>
    wait<{ data: RawCo2 }>({
      data: {
        total_co2_tonnes: round(
          monthTotals(my).reduce((a, t) => a + t.kwh, 0) * 0.00071,
          3
        ),
      },
    }),

  monthlyEnergy: (my: MonthYear) => {
    const totals = monthTotals(my)
    return wait<RawMonthlyEnergy>({
      total_energy: round(
        totals.reduce((a, t) => a + t.kwh, 0),
        1
      ),
      generators: totals.map((t) => ({
        device_id: t.gen.device_id,
        name: t.gen.name,
        energy: round(t.kwh, 1),
      })),
    })
  },

  runtimeFuel: (my: MonthYear) => {
    const totals = monthTotals(my)
    return wait<{ data: RawRuntimeFuel }>({
      data: {
        total_fuel_liters: round(totals.reduce((a, t) => a + t.fuel, 0)),
        total_runtime: `${totals.reduce((a, t) => a + t.runHours, 0)} hrs`,
        generators: totals.map((t) => ({
          device_id: t.gen.device_id,
          name: t.gen.name,
          runtime_hours: t.runHours,
          runtime_formatted: `${t.runHours} hrs`,
          fuel_liters: round(t.fuel),
        })),
      },
    })
  },

  energyFuelSeries: (my: MonthYear) =>
    wait<{ data: RawEnergyFuelSeries }>({
      data: GENERATORS.map((gen) => ({
        device_id: gen.device_id,
        name: gen.name,
        series: dailySeries(gen, my),
      })),
    }),

  fuelUsageSeries: (my: MonthYear) => {
    const perGen = GENERATORS.map((gen) => dailySeries(gen, my))
    const dates = perGen[0]?.map((p) => p.date) ?? []
    return wait<{ data: RawFuelUsageSeries }>({
      data: {
        series: dates.map((date, i) => {
          const ems = perGen.reduce((a, s) => a + (s[i]?.fuel_liters ?? 0), 0)
          const n = noise(Number(date.replaceAll("-", "")) * 3)
          // Operators log diesel on most days, and their figures drift from the
          // meter-based estimate.
          return {
            date,
            fuel_liters: n > 0.2 ? round(ems * (0.85 + n * 0.35), 1) : 0,
            predicted_liters: round(ems, 1),
          }
        }),
      },
    })
  },

  generatorMetrics: (my: MonthYear) =>
    wait<{ data: RawGeneratorMetrics }>({ data: metrics(my) }),

  costMetrics: (my: MonthYear) =>
    wait<{ data: RawCostMetrics }>({ data: cost(my) }),
}
