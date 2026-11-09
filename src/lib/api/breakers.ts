import { apiRequest } from "@/lib/api/client"

/**
 * ACB breakers (remote switching). Shapes inferred from the old, never-routed
 * Breakers.js and BreakersColumns (helpers/tableColumns.js:167-204); not
 * verified live. The old page passed the response straight to its table, so
 * it is an array; a `{data: [...]}` envelope is accepted too.
 */
export type Breaker = {
  id?: number
  device_id: number
  name: string
  provider?: string | null
  is_active?: boolean
  is_load?: boolean
  is_source?: boolean
  branch?: number | string
  switch_state?: "ON" | "OFF" | string | null
}

export type BreakerState = "ON" | "OFF"

type BreakersResponse = Breaker[] | { data?: Breaker[] }

/** GET all_acb/{branch}/ */
export async function getBreakers(
  branchId: number,
  signal?: AbortSignal
): Promise<Breaker[]> {
  const response = await apiRequest<BreakersResponse>(`all_acb/${branchId}/`, {
    signal,
  })
  return Array.isArray(response) ? response : (response?.data ?? [])
}

/** POST toggle_acb/ — switches the physical breaker. `meter_id` is the
 * breaker's `device_id`. */
export const toggleBreaker = (
  branchId: number,
  deviceId: number,
  state: BreakerState
) =>
  apiRequest<unknown>("toggle_acb/", {
    method: "POST",
    body: { state, meter_id: deviceId },
  })
