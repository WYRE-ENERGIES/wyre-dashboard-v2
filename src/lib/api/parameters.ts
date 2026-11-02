import { format } from "date-fns"

import { apiRequest } from "@/lib/api/client"
import type {
  EnergyConsumptionResponse,
  LastReadingResponse,
  PowerDemandResponse,
  PowerQualityResponse,
  TimeOfUseResponse,
} from "@/lib/api/parameters-types"
import { DEMO } from "@/lib/demo"
import { demoParameters } from "@/lib/demo-data/parameters"
import {
  endpointRange,
  GRANULARITY,
  periodEnd,
  type Period,
} from "@/lib/period"

// Parameters endpoints (inventory 06 §2.3), used as they are. Unlike the old
// pages, which always sent "hourly" (03 §0.4), the interval follows the
// period: Day → hourly, Month → daily, Year → monthly.

const ranged = (path: string, id: number, period: Period) =>
  `${path}/${id}/${endpointRange(period)}/${GRANULARITY[period.kind]}`

export const getEnergyConsumption = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoParameters.energyConsumption(period)
    : apiRequest<EnergyConsumptionResponse>(
        ranged("dashboard/energy_consumption", branchId, period),
        {
          signal,
        }
      )

export const getPowerQuality = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoParameters.powerQuality(period)
    : apiRequest<PowerQualityResponse>(
        ranged("dashboard/power_quality", branchId, period),
        { signal }
      )

export const getPowerDemand = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoParameters.powerDemand(period)
    : apiRequest<PowerDemandResponse>(
        ranged("dashboard/power_demand", branchId, period),
        { signal }
      )

/** The moment Last Reading asks for: the period's end ("now" for the current
 * period). The old page sent a malformed date (`01-03-2001`), which made the
 * request take 2+ minutes (inventory 00-live-walkthrough). */
export const lastReadingAsOf = (period: Period) => periodEnd(period)

export const getLastReading = (
  branchId: number,
  period: Period,
  signal?: AbortSignal
) => {
  const asOf = lastReadingAsOf(period)
  return DEMO
    ? demoParameters.lastReading(asOf)
    : apiRequest<LastReadingResponse>(
        `dashboard/last_reading/${branchId}/${encodeURIComponent(format(asOf, "dd-MM-yyyy HH:mm"))}`,
        { signal }
      )
}

/**
 * Time of Use reads the old global organisation payload, keyed by the *user*
 * id (JWT `id`), which returns every branch of the organisation. The old app
 * sent it without a token (services/devices.js); this sends the normal bearer
 * header, which an open endpoint ignores.
 */
export const getTimeOfUse = (
  userId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoParameters.timeOfUse(period)
    : apiRequest<TimeOfUseResponse>(ranged("dashboard", userId, period), {
        signal,
      })
