/**
 * Response and payload shapes of the Cost Tracker endpoints (inventory 06
 * §2.8–2.9, 02 §3–§7). None of these were captured live: they are inferred
 * from the old app's code (`redux/actions/constTracker/costTracker.action.js`,
 * the cost-tracker tables and forms), so fields are optional and numbers may
 * arrive as numeric strings. Read them through `num()` in
 * `@/lib/cost-tracker/rules`.
 */

/** Numbers sometimes arrive as strings (the old tables call toFixed / parseFloat). */
export type Num = number | string | null | undefined

export type Pagination = {
  current_page?: number
  page_size?: number
  total_count?: number
  total_pages?: number
}

/** GET cost-tracker/diesel-overview/{branch}/?page=&page_size= → data.diesel_overview[] */
export type DieselOverviewRow = {
  /** A month label, e.g. "July 2026" (exact format unverified). */
  month: string
  inputted_usage?: Num
  forecasted_usage?: Num
  inputted_cost?: Num
  forecasted_cost?: Num
  diesel_difference?: Num
  cost_difference?: Num
  percentage_usage?: Num
}
export type DieselOverviewResponse = {
  status?: boolean
  message?: string
  data?: { diesel_overview?: DieselOverviewRow[] }
  pagination?: Pagination
}

/** GET cost-tracker/utility-overview/{branch}/ → data.utility_overview[];
 * GET cost-tracker/ipp-overview/{branch} → data.ipp_overview[] (same columns). */
export type UtilityOverviewRow = {
  month: string
  purchased_kwh?: Num
  energy_consumed_kwh?: Num
  purchased_naira?: Num
  energy_consumed_naira?: Num
  difference_kwh?: Num
  difference_naira?: Num
  percentage?: Num
}
export type UtilityOverviewResponse = {
  status?: boolean
  message?: string
  data?: { utility_overview?: UtilityOverviewRow[] }
  pagination?: Pagination
}
export type IppOverviewResponse = {
  status?: boolean
  message?: string
  data?: { ipp_overview?: UtilityOverviewRow[] }
  pagination?: Pagination
}

/** A diesel purchase in the register. `amount` is not sent by the backend;
 * the client computes price_per_litre × quantity. */
export type DieselPurchase = {
  id: number
  date: string
  quantity: Num
  price_per_litre: Num
  fuel_type?: string
}

/** A utility (pre-paid / post-paid) or IPP payment. The backend spells the
 * tariff `tarrif` in the register; edit prefill read `tariff`. */
export type Payment = {
  id: number
  date: string
  end_date?: string | null
  value: Num
  amount: Num
  tarrif?: Num
  tariff?: Num
  vat_inclusive_amount?: Num
  /** Not seen in old code; used if present to tell pre-paid from post-paid. */
  payment_type?: string
  type?: string
}

/** GET cost-tracker/branch-overview/{branch} → data. `ipp` is assumed: the old
 * page read `branch_data.ipp` but never received it. */
export type BranchOverview = {
  branch_name?: string
  branch_data?: {
    diesel?: DieselPurchase[]
    utility?: Payment[]
    ipp?: Payment[]
  }
}
export type BranchOverviewResponse = {
  status?: boolean
  message?: string
  data?: BranchOverview
}

/** GET cost-tracker/baseline/{branch} → data.baseline[deviceName][] */
export type BaselinePoint = { date: string; forecast?: Num; used?: Num }
export type BaselineResponse = {
  status?: boolean
  message?: string
  data?: { branch_name?: string; baseline?: Record<string, BaselinePoint[]> }
}

/** GET diesel_tracker_overview/{branch}/{YYYY}/{M}/ → data[] (month drill-down). */
export type FuelConsumptionDay = {
  fuel_consumption_id?: number
  id?: number
  date: string
  quantity: Num
  hours_of_use?: Num
  record_time?: string
  /** Not in the old mapping; shown when present. */
  end_date?: string | null
  generator_name?: string | null
  device_id?: number | null
  energy_consumed?: Record<string, Num>
  litres_per_hour?: Record<string, Num>
}
export type FuelConsumptionResponse = {
  status?: boolean
  message?: string
  branch_id?: number
  branch_name?: string
  data?: FuelConsumptionDay[]
}

/** GET branch/{branch}/generators/ → generators (old code flattens nested arrays). */
export type Generator = { device_id: number; name: string; id?: number }
export type GeneratorsResponse = { generators?: Array<Generator | Generator[]> }

/** GET cost-tracker/diesel-daily-usage/{branch} → data[] */
export type DailyDieselEntry = {
  id: number
  start_date: string
  end_date?: string | null
  quantity: Num
  record_time?: string | null
  generator_name?: string | null
  device_id?: number | null
}
/** GET cost-tracker/diesel-monthly-usage/{branch} → data[] */
export type MonthlyDieselEntry = {
  id: number
  /** Month name or number (format unverified). */
  month: string | number
  year: string | number
  quantity: Num
  record_time?: string | null
  start_date?: string | null
  end_date?: string | null
}
export type ListResponse<T> = { status?: boolean; message?: string; data?: T[] }

/** GET equipments/{userId}/ → data: { [key]: { id: branchId, equipments[] } } */
export type Equipment = {
  id: number
  name: string
  /** The "wattage" the form asks for is stored as `voltage`. */
  voltage: Num
  quantity: Num
  date_purchased: string
  branch_id?: number
}
export type EquipmentBranch = {
  id: number
  name?: string
  equipments?: Equipment[]
}
export type EquipmentResponse = {
  status?: boolean
  message?: string
  data?: Record<string, EquipmentBranch> | EquipmentBranch[]
}

// ---- Write payloads (06 §2.8–2.9) ----

export type DieselPurchaseInput = {
  quantity: number
  price_per_litre: number
  date: string
}
export type PaymentKind = "pre-paid" | "post-paid" | "ipp"
export type PaymentInput = {
  value: number
  amount: number
  tariff: number
  date: string
  /** Post-paid only: last day of the period covered. */
  end_date?: string
}
export type DailyEntryInput = {
  quantity: number
  start_date: string
  end_date: string
  generator_id?: number
}
export type MonthlyEntryInput = {
  quantity: number
  start_date: string
  end_date: string
}
export type EquipmentInput = {
  name: string
  voltage: number
  quantity: number
  date_purchased: string
}
