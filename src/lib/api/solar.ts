import { apiRequest } from "@/lib/api/client"
import type {
  RawBatteryPlot,
  RawConsumptionPlot,
  RawPvPlot,
  RawSolarLive,
  RawSolarOverview,
  RawSolarYield,
  SolarBatteryPlot,
  SolarConsumptionPlot,
  SolarDate,
  SolarLive,
  SolarPvPlot,
  SolarWeather,
  SolarYield,
} from "@/lib/api/solar-types"
import { DEMO } from "@/lib/demo"
import { demoSolar } from "@/lib/demo-data/solar"
import {
  num,
  optionalNum,
  parseBatteryPlot,
  parseLive,
  parseYield,
  text,
  unwrapSolar,
} from "@/lib/solar/parse"

// Solar Overview endpoints (inventory 06 §2.10 and 07 §2.1), used as they are.
// `solar/site-status/` is no longer called: production replaced it with
// `solar/live/`.

async function get<T>(
  path: string,
  demo: () => Promise<unknown>,
  signal?: AbortSignal
) {
  return unwrapSolar<T>(
    DEMO ? await demo() : await apiRequest<unknown>(path, { signal })
  )
}

/** `?year=&month=[&day=]` — the yield filter and the hourly plots take the
 * same fields (the plots in month/year/day order, as the old app sent them). */
const dateQuery = ({ year, month, day }: SolarDate) =>
  `?month=${month}&year=${year}${day !== undefined ? `&day=${day}` : ""}`

export async function getSolarWeather(
  branchId: number,
  signal?: AbortSignal
): Promise<SolarWeather> {
  const body = await get<RawSolarOverview>(
    `solar/overview/${branchId}/`,
    () => demoSolar.overview(),
    signal
  )
  const w = body?.weather
  return {
    city: text(w?.city),
    condition: text(w?.condition),
    temperatureC: optionalNum(w?.temperature_c),
    sunshine: text(w?.sunshine),
  }
}

export async function getSolarLive(
  branchId: number,
  signal?: AbortSignal
): Promise<SolarLive> {
  return parseLive(
    await get<RawSolarLive>(
      `solar/live/${branchId}/`,
      () => demoSolar.live(),
      signal
    )
  )
}

/** Yield totals. No date = all time (with today / this month buckets); a
 * date = that day or month (one `total` bucket). Slow on the live backend
 * when unfiltered (66 s seen, inventory E6). */
export async function getSolarYield(
  branchId: number,
  date?: SolarDate,
  signal?: AbortSignal
): Promise<SolarYield> {
  const path = `solar/yield/${branchId}/${date ? dateQuery(date) : ""}`
  return parseYield(
    await get<RawSolarYield>(path, () => demoSolar.yield(date), signal)
  )
}

export async function getConsumptionPlot(
  branchId: number,
  date: Required<SolarDate>,
  signal?: AbortSignal
): Promise<SolarConsumptionPlot> {
  const body = await get<RawConsumptionPlot>(
    `solar/${branchId}/consumption-hourly-plot/${dateQuery(date)}`,
    () => demoSolar.consumptionPlot(date),
    signal
  )
  return {
    points: (body?.hours ?? []).map((h) => ({
      label: h.hour_label ?? "",
      pvKw: num(h.pv_kw),
      gridKw: num(h.grid_kw),
      loadKw: num(h.load_kw),
    })),
    totalProductionKwh: optionalNum(body?.total_production_kwh),
    totalConsumptionKwh: optionalNum(body?.total_consumption_kwh),
  }
}

export async function getPvPlot(
  branchId: number,
  date: Required<SolarDate>,
  signal?: AbortSignal
): Promise<SolarPvPlot> {
  const body = await get<RawPvPlot>(
    `solar/${branchId}/pv-production-hourly-plot/${dateQuery(date)}`,
    () => demoSolar.pvPlot(date),
    signal
  )
  return {
    points: (body?.hours ?? []).map((h) => ({
      label: h.hour_label ?? "",
      pvKw: num(h.pv_kw),
    })),
    totalKwh: optionalNum(body?.daily_total_production_kwh),
    peakKw: optionalNum(body?.peak_daily_production_kw),
    peakAt: text(body?.peak_daily_production_at),
  }
}

export async function getBatteryPlot(
  branchId: number,
  date: Required<SolarDate>,
  signal?: AbortSignal
): Promise<SolarBatteryPlot> {
  return parseBatteryPlot(
    await get<RawBatteryPlot>(
      `solar/${branchId}/battery-backup-hourly-plot/${dateQuery(date)}`,
      () => demoSolar.batteryPlot(date),
      signal
    )
  )
}
