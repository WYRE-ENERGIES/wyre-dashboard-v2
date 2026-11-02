import { apiRequest } from "@/lib/api/client"
import { getBranchDemand } from "@/lib/api/endpoints"
import type { BranchDemandResponse, DeviceBase } from "@/lib/api/types"
import { DEMO } from "@/lib/demo"
import { demoLoadOverview } from "@/lib/demo-data/load-overview"
import { endpointRange, GRANULARITY, type Period } from "@/lib/period"

/**
 * GET dashboard/load_overview/{branch}/{start}/{end}/{interval}
 * Device fields inferred from the old code (redux dashboard.action.js:114-133,
 * genericHelpers.js:780-818); not recorded live. `consumption` is kWh for the
 * period and `device_runtime` decimal hours.
 */
export type LoadOverviewDevice = Partial<DeviceBase> & {
  name: string
  branchName?: string
  is_load?: boolean
  is_source?: boolean
  consumption?: number | null
  device_runtime?: number | null
}

export type LoadOverviewResponse = {
  status?: boolean
  message?: string
  authenticatedData: {
    name?: string
    branches: Array<{
      id?: number
      name?: string
      branch_id?: number
      devices: LoadOverviewDevice[]
    }>
  }
}

export const getLoadOverview = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoLoadOverview.overview(branchId, period)
    : apiRequest<LoadOverviewResponse>(
        `dashboard/load_overview/${branchId}/${endpointRange(period)}/${GRANULARITY[period.kind]}`,
        { signal }
      )

/** Per-device demand (branch_demand), which also covers load meters. Demo
 * mode adds demo loads; the real call is the dashboard's. */
export const getLoadDemand = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
): Promise<BranchDemandResponse> =>
  DEMO
    ? demoLoadOverview.demand(branchId, period)
    : getBranchDemand(branchId, period, signal)
