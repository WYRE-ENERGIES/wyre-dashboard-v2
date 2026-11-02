/**
 * Response shapes of the six `scorecard/…` endpoints.
 *
 * Inferred from the old app (redux/actions/scorecard/scorecard.action.js,
 * mainAppPages/ScoreCard.js and components/cards/*), not verified against a
 * live response: every field is optional and numbers may arrive as strings.
 * All six read `response.authenticatedData`. Baseline, PAPR, carbon and
 * generator size put devices under `branches[0].devices`; the old code read
 * fuel consumption and operating time from a root `devices` array.
 * `scoreCardDevices()` in `@/lib/score-card/metrics` accepts either.
 */

type Num = number | string | null | undefined

export type BaselineEnergy = { forecast?: Num; used?: Num; unit?: string }

export type PeakToAvgPowerRatio = { peak?: Num; avg?: Num; unit?: string }

export type ScoreCardCarbonEmissions = {
  estimated_value?: Num
  actual_value?: Num
  unit?: string
}

export type GeneratorSizeEfficiency = {
  name?: string
  /** e.g. "275kVA" */
  size?: string
  /** Load as a percentage of the generator's size. */
  usage?: Num
  unit?: string
  is_gen?: boolean
}

export type FuelConsumption = {
  name?: string
  size?: string
  diesel_usage?: Num
  time_used?: Num
  is_gen?: boolean
  fuel_efficiency?: { current_score?: Num; baseline?: Num; unit?: string }
}

export type OperatingTime = {
  chart?: { dates?: string[]; values?: Num[]; energy_wasted?: Num[] }
  estimated_time_wasted?: { value?: Num; unit?: string }
  estimated_energy_wasted?: { value?: Num; total?: Num; unit?: string }
  estimated_diesel_wasted?: { value?: Num; unit?: string }
  estimated_cost?: { value?: Num; unit?: string }
}

export type ScoreCardDevice = {
  id?: number
  device_id: number
  name: string
  is_source?: boolean
  is_load?: boolean
  device_type?: string
  score_card?: {
    is_generator?: boolean
    baseline_energy?: BaselineEnergy
    peak_to_avg_power_ratio?: PeakToAvgPowerRatio
    score_card_carbon_emissions?: ScoreCardCarbonEmissions
    generator_size_efficiency?: GeneratorSizeEfficiency
    fuel_consumption?: FuelConsumption
    operating_time?: OperatingTime
  }
}

export type ScoreCardResponse = {
  status?: boolean
  message?: string
  authenticatedData?: {
    devices?: ScoreCardDevice[]
    branches?: Array<{
      id?: number
      name?: string
      branch_id?: number
      devices?: ScoreCardDevice[]
    }>
  }
}

export type ScoreCardMetric =
  | "baseline-energy"
  | "peak-to-avg-power-ratio"
  | "carbon-emissions"
  | "generator-size-efficiency"
  | "fuel-consumption"
  | "operating-time"
