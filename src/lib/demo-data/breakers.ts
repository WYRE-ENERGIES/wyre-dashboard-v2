import type { Breaker, BreakerState } from "@/lib/api/breakers"
import { wait } from "@/lib/demo"

/** Demo ACBs: the main incomers plus a few load feeders. Toggles are kept in
 * memory for the session. */
function initial(branchId: number): Breaker[] {
  return [
    {
      id: 1,
      device_id: 101,
      name: "UTILITY",
      provider: "Schneider",
      is_active: true,
      is_load: false,
      is_source: true,
      switch_state: "ON",
    },
    {
      id: 2,
      device_id: 102,
      name: "GEN_275kVA",
      provider: "Schneider",
      is_active: true,
      is_load: false,
      is_source: true,
      switch_state: "OFF",
    },
    {
      id: 3,
      device_id: 103,
      name: "GEN_65kVA",
      provider: "ABB",
      is_active: true,
      is_load: false,
      is_source: true,
      switch_state: "OFF",
    },
    {
      id: 4,
      device_id: 201,
      name: "HVAC",
      provider: "ABB",
      is_active: true,
      is_load: true,
      is_source: false,
      switch_state: "ON",
    },
    {
      id: 5,
      device_id: 203,
      name: "Lighting",
      provider: "ABB",
      is_active: true,
      is_load: true,
      is_source: false,
      switch_state: "ON",
    },
    {
      id: 6,
      device_id: 206,
      name: "Car_Park_Feeder",
      provider: "Siemens",
      is_active: false,
      is_load: true,
      is_source: false,
      switch_state: "OFF",
    },
  ].map((b) => ({ ...b, branch: branchId }))
}

const state = new Map<number, Breaker[]>()
const list = (branchId: number) => state.get(branchId) ?? initial(branchId)

export const demoBreakers = {
  list: (branchId: number) => wait(structuredClone(list(branchId))),
  toggle: async (branchId: number, deviceId: number, next: BreakerState) => {
    await wait(null)
    state.set(
      branchId,
      list(branchId).map((b) =>
        b.device_id === deviceId ? { ...b, switch_state: next } : b
      )
    )
    return { status: true, message: `Breaker switched ${next}` }
  },
}
