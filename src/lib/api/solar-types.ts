/**
 * Solar Overview response shapes. Inferred from production's readers
 * (origin/dev `mainAppPages/SolarOverviewPage.js`, `redux/actions/solar/
 * solar.action.js`; inventory 07 §2), not from a schema, so every field is
 * optional. Most solar endpoints wrap the payload in `{data: …}` and some
 * don't (`data.data ?? data` in the old actions). `src/lib/api/solar.ts`
 * normalises them into the `Solar*` types at the bottom.
 */

type Direction = "IN" | "OUT" | "IDLE" | string

/** GET solar/overview/{branch}/ — only the weather block is still used. */
export type RawSolarOverview = {
  weather?: {
    city?: string | null
    condition?: string | null
    temperature_c?: number | null
    sunshine?: string | null
  }
}

/** GET solar/live/{branch}/ — polled (inventory 07 §2.2). */
export type RawSolarLive = {
  pv?: {
    kw?: number | null
    installed_capacity_kwp?: number | null
    percentage?: number | null
    direction?: Direction
  }
  battery?: {
    kw?: number | null
    percentage?: number | null
    direction?: Direction
    installed_battery_capacity_kwh?: number | null
  } | null
  grid?: {
    kw?: number | null
    direction?: Direction
    status?: "ON" | "OFF" | string
  }
  load?: { kw?: number | null; direction?: Direction }
  generator_power?: {
    kw?: number | null
    direction?: Direction
    status?: "ON" | "OFF" | string
  }
  overlay?: { is_overlay?: boolean; message?: string | null }
  refresh_interval_seconds?: number | null
}

type RawEnergyBucket = {
  kwh?: number | null
  cost?: number | null
  period_label?: string | null
}
type RawBatteryBucket = {
  charge_kwh?: number | null
  charge_cost?: number | null
  discharge_kwh?: number | null
  discharge_cost?: number | null
}
type RawDemandBucket = {
  max_kw?: number | null
  max_at?: string | null
  min_kw?: number | null
  min_at?: string | null
  avg_kw?: number | null
}
type Buckets<T> = { total?: T; today?: T; monthly?: T }

/** GET solar/yield/{branch}/[?year&month[&day]] */
export type RawSolarYield = {
  filter?: { year?: number; month?: number; day?: number | null } | null
  generation?: Buckets<RawEnergyBucket>
  load?: Buckets<RawEnergyBucket>
  grid?: Buckets<RawEnergyBucket>
  battery?: (Buckets<RawBatteryBucket> & Record<string, unknown>) | null
  power_demand?: Buckets<RawDemandBucket>
} & Record<string, unknown>

/** GET solar/{branch}/consumption-hourly-plot/?month&year&day */
export type RawConsumptionPlot = {
  hours?: Array<{
    hour_label?: string
    pv_kw?: number | null
    grid_kw?: number | null
    load_kw?: number | null
  }>
  total_production_kwh?: number | null
  total_consumption_kwh?: number | null
}

/** GET solar/{branch}/pv-production-hourly-plot/?month&year&day */
export type RawPvPlot = {
  hours?: Array<{ hour_label?: string; pv_kw?: number | null }>
  daily_total_production_kwh?: number | null
  peak_daily_production_kw?: number | null
  peak_daily_production_at?: string | null
}

/** GET solar/{branch}/battery-backup-hourly-plot/?month&year&day — keys
 * vary in case and unit suffix (`_kW` / `_kw` / `_kwh`). */
export type RawBatteryPlot = {
  hours?: Array<
    Record<string, unknown> & { hour_label?: string; soc_pct?: number | null }
  >
} & Record<string, unknown>

// ---------------------------------------------------------------------------
// Normalised shapes (numbers are finite; 0 when the API sent nothing).

export type FlowDirection = "IN" | "OUT" | "IDLE" | null

export type SolarWeather = {
  city: string | null
  condition: string | null
  temperatureC: number | null
  sunshine: string | null
}

export type SolarLive = {
  pv: {
    kw: number
    capacityKwp: number
    percent: number
    direction: FlowDirection
  }
  battery: {
    kw: number
    percent: number
    direction: FlowDirection
    capacityKwh: number | null
  } | null
  grid: { kw: number; direction: FlowDirection; on: boolean }
  load: { kw: number; direction: FlowDirection }
  generator: { kw: number; direction: FlowDirection; on: boolean }
  overlay: { active: boolean; message: string }
  refreshSeconds: number | null
}

export type YieldBucketKey = "total" | "today" | "monthly"
export type EnergyRow = { kwh: number; cost: number }
export type BatteryRow = { chargeKwh: number; dischargeKwh: number }
export type DemandRow = {
  maxKw: number
  maxAt: string | null
  minKw: number
  minAt: string | null
  avgKw: number
}

export type SolarYield = {
  /** True when the response is for a day/month window (one "total" bucket). */
  filtered: boolean
  /** API's `generation.total.period_label`, when sent. */
  windowLabel: string | null
  /** "Since …" start of all-time battery tracking, when the API sends it. */
  batterySince: string | null
  generation: Record<YieldBucketKey, EnergyRow>
  load: Record<YieldBucketKey, EnergyRow>
  grid: Record<YieldBucketKey, EnergyRow>
  battery: Record<YieldBucketKey, BatteryRow>
  demand: Record<YieldBucketKey, DemandRow>
}

export type ConsumptionPoint = {
  label: string
  pvKw: number
  gridKw: number
  loadKw: number
}
export type SolarConsumptionPlot = {
  points: ConsumptionPoint[]
  totalProductionKwh: number | null
  totalConsumptionKwh: number | null
}
export type SolarPvPlot = {
  points: Array<{ label: string; pvKw: number }>
  totalKwh: number | null
  peakKw: number | null
  peakAt: string | null
}
export type SolarBatteryPlot = {
  points: Array<{
    label: string
    chargeKw: number
    dischargeKw: number
    socPct: number | null
  }>
  totalCharge: number | null
  totalDischarge: number | null
}

/** `{year, month[, day]}` for `solar/yield` and the hourly plots. */
export type SolarDate = { year: number; month: number; day?: number }
