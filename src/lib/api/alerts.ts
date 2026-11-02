import { apiRequest } from "@/lib/api/client"
import type { AlertsResponse, AlertsSavePayload } from "@/lib/api/alerts-types"
import { DEMO } from "@/lib/demo"
import { demoAlerts } from "@/lib/demo-data/alerts"

// The branch is the JWT's branch (today's endpoints read it from the path,
// and the token decides which branch the user is on).

/** GET alerts_data/{branch} — note: no trailing slash on the GET, as today. */
export const getAlerts = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demoAlerts.get(branchId)
    : apiRequest<AlertsResponse>(`alerts_data/${branchId}`, { signal })

/** POST alerts_data/{branch}/ — answers 202 per the spec. */
export const saveAlerts = (branchId: number, payload: AlertsSavePayload) =>
  DEMO
    ? demoAlerts.save(branchId, payload)
    : apiRequest<unknown>(`alerts_data/${branchId}/`, {
        method: "POST",
        body: payload,
      })
