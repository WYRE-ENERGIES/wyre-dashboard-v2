/**
 * Report endpoints (inventory 06 §2.6):
 * - GET  generate-report/?branch_id&month&year → MonthlyReportResponse (top level, no envelope)
 * - GET  preview-report/?report_type&branch_id&… → { html_email }
 * - POST forward-report/ { …ReportRequest, recipient, carbon_copy }
 *
 * The monthly shape is inferred from the old components/MonthlyReport .js
 * (production, origin/dev), not verified live. Every field is optional and
 * numbers often arrive as strings with units ("1,234.5 kWh"); parse them
 * with `parseQuantity()` from `@/lib/report/monthly`.
 */

export type Qty = number | string | null | undefined
export type Measure = { value?: Qty; unit?: string }

export type ReportRequest =
  | { report_type: "daily"; branch_id: number; date: string }
  | {
      report_type: "periodic"
      branch_id: number
      start_date: string
      end_date: string
    }
  | { report_type: "monthly"; branch_id: number; month: number; year: number }

export type ReportType = ReportRequest["report_type"]

export type PreviewReportResponse = { html_email?: string | null }

export type ForwardReportBody = ReportRequest & {
  recipient: string
  carbon_copy: string[]
}

export type ReportDeviceEntry = {
  name?: string
  /** Month name for the row, e.g. "October". */
  month?: string
  /** "1234.5 kWh" */
  device_energy?: Qty
  actual_energy?: Qty
  expected_bill?: Qty
  actual_cost?: Qty
  usage_accuracy?: Qty
  time_of_use?: Qty
  last_bill_accuracy?: Qty
  optimal_usage?: Qty
  optimal_cost?: Qty
}

export type SolarEntry = ReportDeviceEntry & {
  savings?: Qty
  solar_energy?: Qty
  contribution?: Qty
  period_detail?: string
}

export type ReportPeriodDevices = {
  devices?: {
    utility?: ReportDeviceEntry[]
    generator?: { entries?: ReportDeviceEntry[]; actual_usage?: Qty }
    solar?: SolarEntry[]
  }
}

export type PowerDemandSegment = {
  peak?: Qty
  average?: Qty
  minimum?: Qty
  /** "12,345.6kWh" */
  total_energy?: Qty
  unit?: string
}

export type DeviationRow = {
  month?: string
  name?: string
  value?: Qty
  deviation_time_of_use?: Qty
  diesel_consumption?: Qty
  deviation_cost?: Qty
}

export type MonthlyReportResponse = {
  branch_name?: string
  month?: string
  year?: string | number
  has_solar?: boolean
  branch_type?: string
  is_commercial?: boolean
  total_energy?: Measure
  solar_hour?: Measure
  energy_generated?: {
    current_month?: ReportPeriodDevices
    previous_month_1?: ReportPeriodDevices
    previous_month_2?: ReportPeriodDevices
    this_year?: ReportPeriodDevices
    since_commission?: ReportPeriodDevices
  }
  power_demand?: {
    operational?: PowerDemandSegment
    non_operational?: PowerDemandSegment
    weekends?: PowerDemandSegment
    weekdays?: PowerDemandSegment
  }
  energy_deviation_and_cost?: {
    current_month?: DeviationRow
    previous_month_1?: DeviationRow
    previous_month_2?: DeviationRow
  }
  generator_size_efficiency?: {
    current_month?: Measure & { date?: string }
    previous_month?: Measure & { date?: string }
    /** date is "MM/YYYY" */
    best_month?: Measure & { date?: string }
  }
  fuel_efficiency_accuracy_comparison?: {
    accuracy?: Measure
    recommended?: Measure
    achieved?: Measure
  }
  utility_band_categorization?: Array<{
    band?: string
    total_hours?: Qty
    expected_hours?: Qty
  }>
  data_entry?: Measure
  battery_daily_usage?: {
    month?: string
    year?: string | number
    days?: Array<{
      date?: string
      discharge_kwh?: Qty
      discharge_hours?: Qty
      max_soc?: Qty
    }>
  }
}
