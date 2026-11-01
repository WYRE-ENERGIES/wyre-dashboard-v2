/** Response shapes of today's endpoints, as observed live (30 Oct 2026). */

type Measure = { value: number | null; unit: string }

export type DeviceBase = {
  id: number
  device_id: number
  name: string
  is_load: boolean
  is_source: boolean
  device_type: "GENERATOR" | "UTILITY" | "SOLAR" | "IPP" | string
  source_tag?: "AGGREGATORY" | string
}

type OrgEnvelope<TDevice, TBranchExtra = object> = {
  status: boolean
  message: string
  authenticatedData: {
    id: number
    user_id: number
    branch_id?: number
    name: string
    image?: string
    client_type?: string
    branches: Array<
      {
        id: number
        name: string
        branch_id: number
        devices: TDevice[]
      } & TBranchExtra
    >
  }
}

/** GET side_bar_data */
export type SideBarResponse = OrgEnvelope<DeviceBase>

/** GET dashboard/total_energy/{branch}/{start}/{end}/{interval} */
export type TotalEnergyDevice = DeviceBase & {
  dashboard: {
    total_kwh: Measure
    dashboard_carbon_emissions: Measure
    cost_of_energy: Measure
    today: Measure
    yesterday: Measure
    solar_hours: Measure
  }
}
export type TotalEnergyResponse = OrgEnvelope<TotalEnergyDevice>

/** GET dashboard/device_usage/{branch}/{start}/{end}/{interval} */
export type DeviceUsageDevice = DeviceBase & {
  usage_hours: number
  energy_consumption: {
    previous: number
    current: number
    usage: number
    dates: { dates: string[]; units: string }
    energy_consumption_values: { value: number[]; units: string }
  }
  billing_totals?: {
    previous_total: { usage_kwh: number; value_naira: number }
    present_total: { usage_kwh: number; value_naira: number }
  }
}
export type DeviceUsageResponse = OrgEnvelope<DeviceUsageDevice>

/** GET dashboard/daily_consumption/{branch}/{start}/{end}/{interval}
 * Always daily, whatever the interval; `dates` runs one day past the end. */
export type DailyConsumptionDevice = DeviceBase & { daily_kwh: number[] }
export type DailyConsumptionResponse = OrgEnvelope<
  DailyConsumptionDevice,
  { dates: string[] }
>

/** GET branch_demand/{branch}/{start}/{end} */
export type BranchDemandResponse = {
  status: boolean
  message: string
  data: Array<{
    branch_id: number
    branch_name: string
    unit: string
    papr: number
    devices_demands: Array<{
      device_name: string
      unit: string
      min: number
      max: number
      avg: number
      papr: number
      min_demand_at: string | null
      max_demand_at: string | null
    }>
  }>
}

/** GET blended_cost/{branch}/{start}/{end}/ */
export type BlendedCostResponse = { status: boolean; message: string; data: number | null }

/** GET accounts/user/permitted-branches/ */
export type PermittedBranchesResponse = { branches: Array<{ id: number; name: string }> }

/** POST auth/ and POST force-login/{branchId}/ */
export type TokenResponse = { data: { token: { access: string; refresh: string } } }
