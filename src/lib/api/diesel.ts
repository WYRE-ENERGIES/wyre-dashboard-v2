import { apiRequest } from "@/lib/api/client"
import type {
  CostMetrics,
  DieselPrice,
  FuelUsagePoint,
  GeneratorEnergy,
  GeneratorMetrics,
  GeneratorRuntimeFuel,
  GeneratorSeries,
  GeneratorStatus,
  MonthYear,
  RawCo2,
  RawCostMetrics,
  RawDieselPrice,
  RawEnergyFuelSeries,
  RawFuelUsageSeries,
  RawGeneratorMetrics,
  RawGeneratorsStatus,
  RawMonthlyEnergy,
  RawRuntimeFuel,
} from "@/lib/api/diesel-types"

// Diesel Overview endpoints (inventory 06 §2.11, #81–#89), used as they are:
// the branch is a path segment and the period is `?month=&year=`. The page
// maps the global period onto months (see src/lib/diesel/period.ts).

const num = (value: unknown) => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  return Number.isFinite(n) ? n : 0
}

/** Some of these endpoints wrap the payload in `{data: …}`, some don't. */
function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === "object" && "data" in body)
    return (body as { data: T }).data
  return body as T | undefined
}

async function get<T>(path: string, signal?: AbortSignal) {
  return unwrap<T>(await apiRequest<unknown>(path, { signal }))
}

const ref = (g: { name?: string; device_id?: number }) => ({
  name: g.name?.trim() || "Generator",
  ...(typeof g.device_id === "number" ? { deviceId: g.device_id } : {}),
})

const query = ({ month, year }: MonthYear, extra = "") =>
  `?month=${month}&year=${year}${extra}`

export async function getGeneratorsStatus(
  branchId: number,
  signal?: AbortSignal
): Promise<GeneratorStatus[]> {
  const body = await get<RawGeneratorsStatus>(
    `branch/${branchId}/generators-status/`,
    signal
  )
  return (body?.generators ?? []).map((g) => ({
    ...ref(g),
    isOn: Boolean(g.is_currently_on),
    lastUsed: g.last_usage_time_relative ?? null,
  }))
}

export async function getDieselPrice(
  branchId: number,
  signal?: AbortSignal
): Promise<DieselPrice> {
  const body = await get<RawDieselPrice>(
    `branch/${branchId}/diesel-price/`,
    signal
  )
  return {
    pricePerLitre: num(body?.diesel_price_per_litre),
    efficiencyKwhPerLitre: num(body?.diesel_efficiency),
    monthEstimatedCost: num(body?.month_estimated_cost),
  }
}

/** Tonnes of CO₂ from the generators in one month. */
export async function getGeneratorsCo2(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
) {
  const body = await get<RawCo2>(
    `branch/${branchId}/generators-co2/${query(my)}`,
    signal
  )
  return num(body?.total_co2_tonnes)
}

export async function getGeneratorsMonthlyEnergy(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<GeneratorEnergy[]> {
  const body = await get<RawMonthlyEnergy>(
    `branch/${branchId}/generators-monthly-energy/${query(my)}`,
    signal
  )
  return (body?.generators ?? []).map((g) => ({
    ...ref(g),
    energyKwh: num(g.energy),
  }))
}

export async function getGeneratorRuntimeFuel(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<GeneratorRuntimeFuel[]> {
  const body = await get<RawRuntimeFuel>(
    `branch/${branchId}/generator-runtime-fuel-usage/${query(my)}`,
    signal
  )
  return (body?.generators ?? []).map((g) => ({
    ...ref(g),
    runtimeHours: num(g.runtime_hours),
    fuelLitres: num(g.fuel_liters),
  }))
}

/** Daily kWh and litres per generator for one month. */
export async function getGeneratorEnergyFuelSeries(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<GeneratorSeries[]> {
  const body = await get<RawEnergyFuelSeries>(
    `branch/${branchId}/generator-energy-fuel-series/${query(my, "&frequency=daily")}`,
    signal
  )
  return (Array.isArray(body) ? body : []).map((g) => ({
    ...ref(g),
    points: (g.series ?? [])
      .filter((p) => p.date)
      .map((p) => ({
        date: String(p.date).slice(0, 10),
        kwh: num(p.kwh),
        fuelLitres: num(p.fuel_liters),
      })),
  }))
}

/** Daily reported (logged) vs EMS-estimated litres for one month. */
export async function getFuelUsageSeries(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<FuelUsagePoint[]> {
  const body = await get<RawFuelUsageSeries>(
    `branch/${branchId}/fuel-usage-series/${query(my, "&frequency=daily")}`,
    signal
  )
  return (body?.series ?? [])
    .filter((p) => p.date)
    .map((p) => ({
      date: String(p.date).slice(0, 10),
      reportedLitres: num(p.fuel_liters),
      emsLitres: num(p.predicted_liters),
    }))
}

export async function getGeneratorMetrics(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<GeneratorMetrics> {
  const body = await get<RawGeneratorMetrics>(
    `branch/${branchId}/generator-metrics/${query(my)}`,
    signal
  )
  return {
    fuelEfficiency: num(body?.fuel_efficiency?.value),
    fuelConsumption: num(body?.fuel_consumption?.value),
    demand: {
      max: num(body?.power_demand_kva?.max?.value),
      avg: num(body?.power_demand_kva?.avg?.value),
      min: num(body?.power_demand_kva?.min?.value),
    },
    efficiencyScore: num(body?.generator_efficiency_score?.value),
  }
}

export async function getCostMetrics(
  branchId: number,
  my: MonthYear,
  signal?: AbortSignal
): Promise<CostMetrics> {
  const body = await get<RawCostMetrics>(
    `branch/${branchId}/cost-metrics/${query(my)}`,
    signal
  )
  return {
    totalCost: num(body?.total_cost?.value),
    costPerKwh: num(body?.blended_cost?.value),
    annualForecast: num(body?.annual_cost_forecast?.value),
  }
}
