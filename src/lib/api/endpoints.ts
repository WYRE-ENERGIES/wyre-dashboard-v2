import { apiRequest } from "@/lib/api/client"
import type {
  BlendedCostResponse,
  BranchDemandResponse,
  DailyConsumptionResponse,
  DeviceUsageResponse,
  PermittedBranchesResponse,
  SideBarResponse,
  TokenResponse,
  TotalEnergyResponse,
} from "@/lib/api/types"
import { endpointRange, GRANULARITY, type Period } from "@/lib/period"

// Today's endpoints, used as they are (inventory: "Endpoints: use what exists
// today first"). The branch comes from the URL path; it is the JWT's branch.

export const login = (username: string, password: string) =>
  apiRequest<TokenResponse>("auth/", {
    method: "POST",
    body: { username, password },
    anonymous: true,
  })

export const switchBranchToken = (branchId: number) =>
  apiRequest<TokenResponse>(`force-login/${branchId}/`, {
    method: "POST",
    body: {},
  })

/** Forgot password: emails a reset link (old app: authPages/ResetPassword.js). */
export const requestPasswordReset = (email: string) =>
  apiRequest<{ message: string }>("accounts/reset_password/", {
    method: "POST",
    body: { email },
    anonymous: true,
  })

/** Checks the `?token=` from the reset email before showing the form. */
export const validateResetToken = (token: string) =>
  apiRequest<{ valid: boolean; reason?: string | null }>(
    `validate_reset_token/?token=${encodeURIComponent(token)}`,
    { anonymous: true }
  )

export const confirmPasswordReset = (token: string, newPassword: string) =>
  apiRequest<{ message: string }>("accounts/confirm_reset_password/", {
    method: "POST",
    body: { token, new_password: newPassword },
    anonymous: true,
  })

export const getPermittedBranches = () =>
  apiRequest<PermittedBranchesResponse>("accounts/user/permitted-branches/")

export const getSideBar = () => apiRequest<SideBarResponse>("side_bar_data")

const ranged = (
  path: string,
  branchId: number,
  period: Period,
  withInterval = true
) =>
  `${path}/${branchId}/${endpointRange(period)}${withInterval ? `/${GRANULARITY[period.kind]}` : ""}`

export const getTotalEnergy = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  apiRequest<TotalEnergyResponse>(
    ranged("dashboard/total_energy", branchId, period),
    { signal }
  )

export const getDeviceUsage = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  apiRequest<DeviceUsageResponse>(
    ranged("dashboard/device_usage", branchId, period),
    { signal }
  )

export const getDailyConsumption = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  apiRequest<DailyConsumptionResponse>(
    ranged("dashboard/daily_consumption", branchId, period),
    {
      signal,
    }
  )

export const getBranchDemand = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  apiRequest<BranchDemandResponse>(
    // With the slash: without it the backend answers with a redirect.
    `${ranged("branch_demand", branchId, period, false)}/`,
    { signal }
  )

export const getBlendedCost = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  apiRequest<BlendedCostResponse>(
    `${ranged("blended_cost", branchId, period, false)}/`,
    {
      signal,
    }
  )
