/**
 * Alerts and Alarms settings: GET `alerts_data/{branch}` and
 * POST `alerts_data/{branch}/`.
 *
 * Shapes are inferred from production code (origin/dev
 * mainAppPages/AlertsAndAlarms.js) and the spec PDF in inventory 07 §3.4; the
 * GET was seen live (0.5 s) but its body was not recorded, so every field is
 * optional and unknown keys are kept and sent back.
 */

/** Numbers sometimes come back as strings from Django decimal fields. */
type Num = number | string | null

export type AlertsData = {
  id?: number
  branch?: number
  // Energy usage reports (daily 10:00, weekly Monday 10:00, Africa/Lagos).
  daily_energy_usage_alerts?: boolean
  weekly_energy_usage_alerts?: boolean
  /** CSV of weekdays, Mon=0 … Sun=6. Default "0,1,2,3,4,5,6". */
  daily_energy_usage_days?: string | null
  daily_battery_soc_alerts?: boolean
  daily_unfavorable_weather_alerts?: boolean
  solar_capacity_utilization_alerts?: boolean
  /** 0–90, default 90. */
  solar_capacity_utilization_threshold_pct?: Num
  max_power_factor?: Num
  min_power_factor?: Num
  power_factor_alerts?: boolean
  load_balance_alerts?: boolean
  frequency_precision?: Num
  frequency_alerts?: boolean
  max_voltage?: Num
  min_voltage?: Num
  voltage_alerts?: boolean
  baseline_alerts?: boolean
  energy_usage_max?: Num
  energy_usage_alerts?: boolean
  emitted_co2_alerts?: boolean
  set_co2_value?: Num
  set_co2_alerts?: boolean
  operating_time_alerts?: boolean
  load_threshold_value?: Num
  load_alerts?: boolean
  /** Read-only per the spec ("Do not POST solar_power_demand_alerts"). */
  solar_power_demand_alerts?: boolean
  [key: string]: unknown
}

export type SocOperator = "lte" | "gte"

export type BatterySocConfig = {
  id?: number
  branch_id?: number
  branch_name?: string
  notification_type?: string
  is_enabled?: boolean
  push_enabled?: boolean
  email_enabled?: boolean
  schedule_times?: Array<{
    id?: number
    time: string
    days_of_week?: string | null
    last_sent_on?: string | null
  }>
  thresholds?: Array<{
    id?: number
    metric?: string
    operator: SocOperator
    value: number | string
  }>
  updated_at?: string
}

export type AlertsResponse = {
  data?: AlertsData
  generator_data?: unknown[]
  /** Present only for branches with a battery (solar sites). */
  battery_soc_config?: BatterySocConfig | null
  [key: string]: unknown
}

export type AlertsSavePayload = {
  data: Record<string, unknown>
  generator_data: unknown[]
  battery_soc_config?: {
    is_enabled: boolean
    push_enabled: boolean
    email_enabled: boolean
    /** `days_of_week` is omitted when it is every day (production behaviour). */
    schedule_times: Array<{ time: string; days_of_week?: string }>
    thresholds: Array<{ operator: SocOperator; value: number }>
  }
}
