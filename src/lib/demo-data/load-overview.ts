import type { LoadOverviewResponse } from "@/lib/api/load-overview"
import type { BranchDemandResponse } from "@/lib/api/types"
import { currentBranch, dayKey, DEVICES, noise, totals, wait } from "@/lib/demo"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Demo load meters. Lekki and Abuja have five sub-metered loads; Ikeja
 * (branch 2) has only source meters, which shows the "no load meters" state
 * the old page never had (it spun forever).
 */
const LOADS = [
  { id: 201, name: "HVAC", share: 0.38, duty: 0.62, kw: 46 },
  { id: 202, name: "Kitchen", share: 0.13, duty: 0.48, kw: 22 },
  { id: 203, name: "Lighting", share: 0.12, duty: 0.55, kw: 14 },
  { id: 204, name: "Lifts", share: 0.08, duty: 0.4, kw: 18 },
  { id: 205, name: "Server_Room", share: 0.06, duty: 1, kw: 5 },
]

const hasLoads = (branchId: number) => branchId !== 2

function periodHours(period: Period) {
  return Math.max(
    0,
    (periodEnd(period).getTime() - periodStart(period).getTime()) / 3_600_000
  )
}

export const demoLoadOverview = {
  overview: (branchId: number, period: Period) => {
    const sources = totals(period)
    const buildingKwh = sources.reduce((acc, s) => acc + s.kwh, 0)
    const seed = dayKey(periodStart(period))
    const branch = currentBranch()
    const devices = [
      ...sources.map(({ device, kwh, hours }) => ({
        id: device.id,
        device_id: device.device_id,
        name: device.name,
        device_type: device.device_type,
        branchName: branch.name,
        is_source: true,
        is_load: false,
        consumption: Math.round(kwh * 10) / 10,
        device_runtime: hours,
      })),
      ...(hasLoads(branchId)
        ? LOADS.map((load) => ({
            id: load.id,
            device_id: load.id,
            name: load.name,
            device_type: "LOAD",
            branchName: branch.name,
            is_source: false,
            is_load: true,
            consumption:
              Math.round(
                buildingKwh *
                  load.share *
                  (0.9 + noise(seed + load.id) * 0.2) *
                  10
              ) / 10,
            device_runtime:
              Math.round(
                periodHours(period) *
                  load.duty *
                  (0.85 + noise(seed * 3 + load.id) * 0.15) *
                  100
              ) / 100,
          }))
        : []),
    ]
    return wait<LoadOverviewResponse>({
      status: true,
      message: "Successful",
      authenticatedData: {
        name: "Demo Retail Ltd",
        branches: [
          { id: branch.id, name: branch.name, branch_id: branch.id, devices },
        ],
      },
    })
  },

  demand: (branchId: number, period: Period) => {
    const seed = dayKey(periodStart(period))
    const scale = currentBranch().scale
    const meters = [
      ...DEVICES.map((d) => ({ name: d.name, kw: d.kw, id: d.device_id })),
      ...(hasLoads(branchId)
        ? LOADS.map((l) => ({ name: l.name, kw: l.kw, id: l.id }))
        : []),
    ]
    return wait<BranchDemandResponse>({
      status: true,
      message: "Successful",
      data: [
        {
          branch_id: branchId,
          branch_name: currentBranch().name,
          unit: "kVA",
          papr: 0.6,
          devices_demands: meters.map((m) => {
            const max = m.kw * scale * (1.1 + noise(seed + m.id) * 0.3)
            return {
              device_name: m.name,
              unit: "kVA",
              max,
              avg: max * 0.6,
              min: max * 0.25,
              papr: 0.6,
              min_demand_at: null,
              max_demand_at: null,
            }
          }),
        },
      ],
    })
  },
}
