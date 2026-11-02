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
import { DEMO, demoApi } from "@/lib/demo"
import { endpointRange, GRANULARITY, type Period } from "@/lib/period"

// Today's endpoints, used as they are (inventory: "Endpoints: use what exists
// today first"). The branch comes from the URL path; it is the JWT's branch.
// In demo mode (NEXT_PUBLIC_WYRE_DEMO=1) calls return generated sample data.

export const login = (username: string, password: string) =>
  DEMO
    ? demoApi.login(username, password)
    : apiRequest<TokenResponse>("auth/", {
        method: "POST",
        body: { username, password },
        anonymous: true,
      })

export const switchBranchToken = (branchId: number) =>
  DEMO
    ? demoApi.switchBranch(branchId)
    : apiRequest<TokenResponse>(`force-login/${branchId}/`, {
        method: "POST",
        body: {},
      })

/** Forgot password: emails a reset link (old app: authPages/ResetPassword.js). */
export const requestPasswordReset = (email: string) =>
  DEMO
    ? demoApi.requestPasswordReset(email)
    : apiRequest<{ message: string }>("accounts/reset_password/", {
        method: "POST",
        body: { email },
        anonymous: true,
      })

/** Checks the `?token=` from the reset email before showing the form. */
export const validateResetToken = (token: string) =>
  DEMO
    ? demoApi.validateResetToken(token)
    : apiRequest<{ valid: boolean; reason?: string | null }>(
        `validate_reset_token/?token=${encodeURIComponent(token)}`,
        { anonymous: true }
      )

export const confirmPasswordReset = (token: string, newPassword: string) =>
  DEMO
    ? demoApi.confirmPasswordReset(token, newPassword)
    : apiRequest<{ message: string }>("accounts/confirm_reset_password/", {
        method: "POST",
        body: { token, new_password: newPassword },
        anonymous: true,
      })

export const getPermittedBranches = () =>
  DEMO
    ? demoApi.permittedBranches()
    : apiRequest<PermittedBranchesResponse>("accounts/user/permitted-branches/")

export const getSideBar = () =>
  DEMO ? demoApi.sideBar() : apiRequest<SideBarResponse>("side_bar_data")

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
  DEMO
    ? demoApi.totalEnergy(period)
    : apiRequest<TotalEnergyResponse>(
        ranged("dashboard/total_energy", branchId, period),
        { signal }
      )

export const getDeviceUsage = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoApi.deviceUsage(period)
    : apiRequest<DeviceUsageResponse>(
        ranged("dashboard/device_usage", branchId, period),
        { signal }
      )

export const getDailyConsumption = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoApi.dailyConsumption(period)
    : apiRequest<DailyConsumptionResponse>(
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
  DEMO
    ? demoApi.branchDemand(period)
    : apiRequest<BranchDemandResponse>(
        ranged("branch_demand", branchId, period, false),
        { signal }
      )

export const getBlendedCost = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoApi.blendedCost(period)
    : apiRequest<BlendedCostResponse>(
        `${ranged("blended_cost", branchId, period, false)}/`,
        {
          signal,
        }
      )
