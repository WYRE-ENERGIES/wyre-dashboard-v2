import { endOfDay, endOfMonth, endOfYear, format } from "date-fns"

import type {
  ScoreCardDevice,
  ScoreCardMetric,
  ScoreCardResponse,
} from "@/lib/api/score-card-types"
import {
  base,
  currentBranch,
  dayKey,
  daysOf,
  envelope,
  hourlyKwh,
  noise,
  totals,
  wait,
} from "@/lib/demo"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/** Demo Score Card: the same four devices and energy as the dashboard, shaped
 * like the six `scorecard/…` responses. */

const SIZES: Record<string, number> = { GEN_275kVA: 275, GEN_65kVA: 65 }
const CO2_TONS_PER_KWH: Record<string, number> = {
  GENERATOR: 0.00071,
  UTILITY: 0.00043,
  SOLAR: 0,
}

/** Full-period multiplier, so forecasts cover the whole day / month / year. */
function fullPeriodFactor(period: Period) {
  const start = periodStart(period)
  const fullEnd =
    period.kind === "day"
      ? endOfDay(start)
      : period.kind === "month"
        ? endOfMonth(start)
        : endOfYear(start)
  const elapsed = periodEnd(period).getTime() - start.getTime()
  return elapsed > 0 ? (fullEnd.getTime() - start.getTime()) / elapsed : 1
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

function devicesFor(
  metric: ScoreCardMetric,
  period: Period
): ScoreCardDevice[] {
  const seed = dayKey(periodStart(period))
  const factor = fullPeriodFactor(period)
  const all = totals(period)
  const sourceKwh = all.reduce((sum, t) => sum + t.kwh, 0)
  const scale = currentBranch().scale

  return all.map(({ device, kwh, hours }) => {
    const isGen = device.device_type === "GENERATOR"
    const n = noise(seed + device.device_id)
    const kva = SIZES[device.name] ?? 0
    const sc: NonNullable<ScoreCardDevice["score_card"]> = {
      is_generator: isGen,
    }

    if (metric === "baseline-energy") {
      // Branch-level baseline, repeated on each device like the API.
      sc.baseline_energy = {
        forecast: round(sourceKwh * factor * (1.02 + noise(seed) * 0.12)),
        used: round(sourceKwh),
        unit: "kWh",
      }
    }
    if (metric === "peak-to-avg-power-ratio") {
      const peak = device.kw * scale * (1.4 + n * 0.5)
      sc.peak_to_avg_power_ratio = {
        peak: round(peak),
        avg: round(peak * (0.32 + n * 0.3)),
        unit: "kVA",
      }
    }
    if (metric === "carbon-emissions") {
      const actual = kwh * (CO2_TONS_PER_KWH[device.device_type] ?? 0)
      sc.score_card_carbon_emissions = {
        estimated_value: round(actual * factor * (1 + n * 0.15), 3),
        actual_value: round(actual, 3),
        unit: "tons",
      }
    }
    if (metric === "generator-size-efficiency") {
      sc.generator_size_efficiency = {
        name: device.name,
        size: kva ? `${kva}kVA` : "",
        usage: isGen ? round((kva > 100 ? 38 : 50) + n * 22) : 0,
        unit: "%",
        is_gen: isGen,
      }
    }
    if (metric === "fuel-consumption") {
      const efficiency = 3.1 + n * 0.8
      sc.fuel_consumption = {
        name: device.name,
        size: kva ? `${kva}kVA` : "",
        diesel_usage: isGen ? round(kwh / efficiency) : 0,
        time_used: isGen ? hours : 0,
        is_gen: isGen,
        fuel_efficiency: {
          current_score: isGen ? round(efficiency) : 0,
          baseline: 4.2,
        },
      }
    }
    if (metric === "operating-time") {
      const days = daysOf(period)
      const end = periodEnd(period).getTime()
      // Generator hours after 6pm or on weekends count as outside operating hours.
      const values = days.map((day) =>
        round(
          Array.from({ length: 24 }, (_, h) => h).filter(
            (h) =>
              day.getTime() + h * 3_600_000 <= end &&
              hourlyKwh(device, day, h) > 0 &&
              (h >= 18 || [0, 6].includes(day.getDay()))
          ).length * (isGen ? 0.25 : 0)
        )
      )
      const wasted = values.map((v) => round(v * device.kw * scale * 0.55, 1))
      const timeWasted = values.reduce((a, b) => a + b, 0)
      const energyWasted = wasted.reduce((a, b) => a + b, 0)
      sc.operating_time = {
        chart: {
          dates: days.map((d) => format(d, "yyyy-MM-dd")),
          values,
          energy_wasted: wasted,
        },
        estimated_time_wasted: { value: round(timeWasted), unit: "hours" },
        estimated_energy_wasted: { value: round(energyWasted), unit: "kWh" },
        estimated_diesel_wasted: {
          value: round(energyWasted / 3.4),
          unit: "litres",
        },
        estimated_cost: {
          value: Math.round((energyWasted / 3.4) * 1150),
          unit: "naira",
        },
      }
    }

    return { ...base(device), score_card: sc }
  })
}

export function demoScoreCard(metric: ScoreCardMetric, period: Period) {
  const devices = devicesFor(metric, period)
  // Like the API: fuel consumption and operating time come back with a root
  // `devices` list; the other four under branches[0].
  const response =
    metric === "fuel-consumption" || metric === "operating-time"
      ? { status: true, message: "Successful", authenticatedData: { devices } }
      : envelope(devices)
  return wait(response as ScoreCardResponse)
}
