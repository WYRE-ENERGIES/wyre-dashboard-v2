/**
 * Diesel Overview response shapes (`branch/{id}/…?month=&year=`).
 *
 * These are inferred from the old app's readers (origin/dev
 * `components/DieselHeader.js`, `TotalEnergyUsed.js`, `GeneratorStatus2.js`,
 * `FuelUsageBreakupCard.js`, `FuelUsageCard.js`, `OperationalEfficiencyCard.js`,
 * `CostAnalysisCard.js`), not verified against a schema, so every field is
 * optional. `src/lib/api/diesel.ts` normalises them into the `Diesel*` types
 * below, which the page uses.
 */

type Valued = { value?: number | null; unit?: string }

/** GET branch/{id}/generators-status/ → `{ generators: [...] }` */
export type RawGeneratorsStatus = {
  generators?: Array<{
    id?: number
    device_id?: number
    name?: string
    is_currently_on?: boolean
    last_usage_time_relative?: string | null
  }>
}

/** GET branch/{id}/diesel-price/ → `{ data: {...} }` */
export type RawDieselPrice = {
  diesel_price_per_litre?: number | null
  diesel_efficiency?: number | null
  month_estimated_cost?: number | null
}

/** GET branch/{id}/generators-co2/?month&year → `{ data: { total_co2_tonnes } }` */
export type RawCo2 = { total_co2_tonnes?: number | null }

/** GET branch/{id}/generators-monthly-energy/?month&year → `{ total_energy, generators }`
 * (the old page read it without a `data` wrapper). */
export type RawMonthlyEnergy = {
  total_energy?: number | null
  generators?: Array<{
    id?: number
    device_id?: number
    name?: string
    energy?: number | null
  }>
}

/** GET branch/{id}/generator-runtime-fuel-usage/?month&year → `{ data: {...} }` */
export type RawRuntimeFuel = {
  total_fuel_liters?: number | null
  total_runtime?: string | null
  generators?: Array<{
    id?: number
    device_id?: number
    name?: string
    runtime_hours?: number | null
    runtime_formatted?: string | null
    fuel_liters?: number | null
  }>
}

/** GET branch/{id}/generator-energy-fuel-series/?month&year[&frequency] → `{ data: [...] }` */
export type RawEnergyFuelSeries = Array<{
  id?: number
  device_id?: number
  name?: string
  series?: Array<{
    date?: string
    kwh?: number | null
    fuel_liters?: number | null
  }>
}>

/** GET branch/{id}/fuel-usage-series/?month&year[&frequency] → `{ data: { series } }` */
export type RawFuelUsageSeries = {
  series?: Array<{
    date?: string
    fuel_liters?: number | null
    predicted_liters?: number | null
  }>
}

/** GET branch/{id}/generator-metrics/?month&year → `{ data: {...} }` */
export type RawGeneratorMetrics = {
  fuel_efficiency?: Valued
  fuel_consumption?: Valued
  power_demand_kva?: { max?: Valued; avg?: Valued; min?: Valued }
  generator_efficiency_score?: Valued
}

/** GET branch/{id}/cost-metrics/?month&year → `{ data: {...} }` */
export type RawCostMetrics = {
  total_cost?: Valued
  blended_cost?: Valued
  annual_cost_forecast?: Valued
}

// ---------------------------------------------------------------------------
// Normalised shapes (numbers are always finite; 0 when the API sent nothing).

/** A generator as the page identifies it: by device id when the API sends
 * one, otherwise by name. */
export type GeneratorRef = { name: string; deviceId?: number }

export type GeneratorStatus = GeneratorRef & {
  isOn: boolean
  lastUsed: string | null
}

export type DieselPrice = {
  pricePerLitre: number
  efficiencyKwhPerLitre: number
  monthEstimatedCost: number
}

export type GeneratorEnergy = GeneratorRef & { energyKwh: number }

export type GeneratorRuntimeFuel = GeneratorRef & {
  runtimeHours: number
  fuelLitres: number
}

export type EnergyFuelPoint = { date: string; kwh: number; fuelLitres: number }
export type GeneratorSeries = GeneratorRef & { points: EnergyFuelPoint[] }

export type FuelUsagePoint = {
  date: string
  reportedLitres: number
  emsLitres: number
}

export type GeneratorMetrics = {
  fuelEfficiency: number
  /** Raw `fuel_consumption.value`; the page divides by 1000 for L/kWh. */
  fuelConsumption: number
  demand: { max: number; avg: number; min: number }
  efficiencyScore: number
}

export type CostMetrics = {
  totalCost: number
  costPerKwh: number
  annualForecast: number
}

/** `{month, year}` for the `?month=&year=` endpoints (month 1–12). */
export type MonthYear = { month: number; year: number }
