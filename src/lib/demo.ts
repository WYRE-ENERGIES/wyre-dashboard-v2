import { eachDayOfInterval, format, getHours } from "date-fns"

import type {
  BlendedCostResponse,
  TokenResponse,
  BranchDemandResponse,
  DailyConsumptionResponse,
  DeviceBase,
  DeviceUsageResponse,
  PermittedBranchesResponse,
  SideBarResponse,
  TotalEnergyResponse,
} from "@/lib/api/types"
import { ApiError } from "@/lib/api/client"
import { readTokens, type SessionTokens, type UserClaims } from "@/lib/auth/session"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Demo mode: the app runs without signing in, on generated sample data shaped
 * exactly like today's API responses. Turn on with NEXT_PUBLIC_WYRE_DEMO=1.
 * The numbers are synthetic, not any customer's data.
 */
export const DEMO = process.env.NEXT_PUBLIC_WYRE_DEMO === "1"

export const demoClaims: UserClaims = {
  exp: 4102444800,
  user_id: 1,
  id: 1,
  first_name: "Ada",
  last_name: "Okafor",
  email: "ada@example.com",
  username: "demo",
  client: "Demo Retail Ltd",
  client_type: "STANDARD",
  client_id: 1,
  role_text: "OPERATOR",
  branch_id: 1,
  has_ems: true,
  has_solar: false,
}

export const DEMO_BRANCHES = [
  { id: 1, name: "Lekki Branch", scale: 1 },
  { id: 2, name: "Ikeja Branch", scale: 0.7 },
  { id: 3, name: "Abuja Branch", scale: 1.35 },
]

// Demo sessions use tokens like "demo-branch-2" instead of real JWTs.
const DEMO_TOKEN_PREFIX = "demo-branch-"

export function demoClaimsFor(access: string | null | undefined): UserClaims | null {
  if (!access?.startsWith(DEMO_TOKEN_PREFIX)) return null
  const branchId = Number(access.slice(DEMO_TOKEN_PREFIX.length)) || 1
  return { ...demoClaims, branch_id: branchId }
}

const demoTokens = (branchId: number): TokenResponse => ({
  data: { token: { access: `${DEMO_TOKEN_PREFIX}${branchId}`, refresh: "demo" } satisfies SessionTokens },
})

function currentBranch() {
  const id = demoClaimsFor(readTokens()?.access)?.branch_id ?? 1
  return DEMO_BRANCHES.find((b) => b.id === id) ?? DEMO_BRANCHES[0]
}

const DEVICES: Array<DeviceBase & { kw: number; dayShare: number; nightShare: number }> = [
  { id: 1, device_id: 101, name: "UTILITY", device_type: "UTILITY", is_source: true, is_load: false, source_tag: "AGGREGATORY", kw: 38, dayShare: 0.55, nightShare: 0.7 },
  { id: 2, device_id: 102, name: "GEN_275kVA", device_type: "GENERATOR", is_source: true, is_load: false, source_tag: "AGGREGATORY", kw: 62, dayShare: 0.35, nightShare: 0.1 },
  { id: 3, device_id: 103, name: "GEN_65kVA", device_type: "GENERATOR", is_source: true, is_load: false, source_tag: "AGGREGATORY", kw: 24, dayShare: 0.1, nightShare: 0.2 },
  { id: 4, device_id: 104, name: "Solar_Inverter", device_type: "SOLAR", is_source: true, is_load: false, source_tag: "AGGREGATORY", kw: 30, dayShare: 0.25, nightShare: 0 },
]

const base = (d: (typeof DEVICES)[number]): DeviceBase => ({
  id: d.id,
  device_id: d.device_id,
  name: d.name,
  device_type: d.device_type,
  is_source: d.is_source,
  is_load: d.is_load,
  source_tag: d.source_tag,
})

/** Deterministic noise so the same period always shows the same numbers. */
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const dayKey = (d: Date) => Number(format(d, "yyyyMMdd"))

/** kWh a device supplied in a given hour. */
function hourlyKwh(device: (typeof DEVICES)[number], date: Date, hour: number) {
  const daytime = hour >= 8 && hour < 18
  const weekend = [0, 6].includes(date.getDay())
  const share = daytime ? device.dayShare : device.nightShare
  const load = (daytime ? 1 : 0.45) * (weekend ? 0.6 : 1)
  const n = noise(dayKey(date) * 31 + hour * 7 + device.device_id)
  // Generators cut in when the grid drops: random outages zero some hours.
  const on = device.device_type === "UTILITY" ? n > 0.25 : device.device_type === "GENERATOR" ? n > 0.55 : daytime
  return on ? Math.round(device.kw * currentBranch().scale * share * load * (0.7 + n * 0.6) * 10) / 10 : 0
}

function daysOf(period: Period) {
  return eachDayOfInterval({ start: periodStart(period), end: periodEnd(period) })
}

function totals(period: Period) {
  const end = periodEnd(period)
  return DEVICES.map((device) => {
    let kwh = 0
    let solarHoursKwh = 0
    let hours = 0
    for (const day of daysOf(period)) {
      for (let hour = 0; hour < 24; hour++) {
        if (day.getTime() + hour * 3_600_000 > end.getTime()) break
        const v = hourlyKwh(device, day, hour)
        kwh += v
        if (hour >= 8 && hour < 18) solarHoursKwh += v
        if (v > 0) hours += 1
      }
    }
    return { device, kwh, solarHoursKwh, hours }
  })
}

const envelope = <T,>(devices: T[], extra: object = {}) => ({
  status: true,
  message: "Successful",
  authenticatedData: {
    id: 1,
    user_id: 1,
    branch_id: 1,
    name: demoClaims.client,
    branches: [{ id: 1, name: currentBranch().name, branch_id: currentBranch().id, devices, ...extra }],
  },
})

const wait = <T,>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), 300 + Math.random() * 700))

export const demoApi = {
  sideBar: () => wait(envelope(DEVICES.map(base)) as SideBarResponse),

  permittedBranches: () =>
    wait<PermittedBranchesResponse>({ branches: DEMO_BRANCHES.map(({ id, name }) => ({ id, name })) }),

  /** Any username works; the password "wrong" shows the error state. */
  login: async (_username: string, password: string) => {
    await wait(null)
    if (password.trim().toLowerCase() === "wrong") {
      throw new ApiError("Invalid username or password", 400, null)
    }
    return demoTokens(1)
  },

  switchBranch: (branchId: number) => wait(demoTokens(branchId)),

  /** Always "sends" the email, like the real endpoint does for unknown addresses. */
  requestPasswordReset: (_email: string) => wait({ message: "Password reset email sent." }),

  /** Tokens "expired" and "invalid" show those states; anything else is valid. */
  validateResetToken: (token: string) =>
    wait({
      valid: !["expired", "invalid"].includes(token),
      reason: token === "expired" ? "expired" : token === "invalid" ? "invalid" : null,
    }),

  confirmPasswordReset: (_token: string, _password: string) =>
    wait({ message: "Password reset successful." }),

  totalEnergy: (period: Period) => {
    const now = new Date()
    const today = DEVICES.map((d) => Array.from({ length: getHours(now) }, (_, h) => hourlyKwh(d, now, h)).reduce((a, b) => a + b, 0))
    const yesterdayDate = new Date(now.getTime() - 86_400_000)
    const yesterday = DEVICES.map((d) => Array.from({ length: 24 }, (_, h) => hourlyKwh(d, yesterdayDate, h)).reduce((a, b) => a + b, 0))
    return wait(
      envelope(
        totals(period).map(({ device, kwh, solarHoursKwh }, i) => ({
          ...base(device),
          dashboard: {
            total_kwh: { unit: "kWh", value: kwh },
            dashboard_carbon_emissions: { unit: "Tons", value: device.device_type === "GENERATOR" ? kwh * 0.00071 : device.device_type === "UTILITY" ? kwh * 0.00043 : 0 },
            cost_of_energy: { unit: "Naira/kWh", value: null },
            today: { unit: "kWh", value: today[i] },
            yesterday: { unit: "kWh", value: yesterday[i] },
            solar_hours: { unit: "kWh", value: solarHoursKwh },
          },
        }))
      ) as TotalEnergyResponse
    )
  },

  deviceUsage: (period: Period) => {
    const days = daysOf(period)
    return wait(
      envelope(
        totals(period).map(({ device, kwh, hours }) => {
          const dates =
            period.kind === "day"
              ? Array.from({ length: 24 }, (_, h) => format(new Date(days[0].getTime() + h * 3_600_000), "yyyy-MM-dd'T'HH:00:00"))
              : []
          const end = periodEnd(period).getTime()
          const values =
            period.kind === "day"
              ? Array.from({ length: 24 }, (_, h) =>
                  days[0].getTime() + h * 3_600_000 > end ? 0 : hourlyKwh(device, days[0], h)
                )
              : []
          return {
            ...base(device),
            usage_hours: hours,
            energy_consumption: {
              previous: 100_000,
              current: 100_000 + kwh,
              usage: kwh,
              dates: { dates, units: "" },
              energy_consumption_values: { value: values, units: "kWh" },
            },
            billing_totals: {
              previous_total: { usage_kwh: 0, value_naira: 0 },
              present_total: { usage_kwh: kwh, value_naira: device.device_type === "UTILITY" ? kwh * 209 : 0 },
            },
          }
        })
      ) as DeviceUsageResponse
    )
  },

  dailyConsumption: (period: Period) => {
    const days = daysOf(period)
    return wait(
      envelope(
        DEVICES.map((device) => ({
          ...base(device),
          daily_kwh: days.map((day) =>
            Math.round(Array.from({ length: 24 }, (_, h) => hourlyKwh(device, day, h)).reduce((a, b) => a + b, 0) * 10) / 10
          ),
        })),
        { dates: days.map((d) => format(d, "yyyy-MM-dd")) }
      ) as DailyConsumptionResponse
    )
  },

  branchDemand: (period: Period) => {
    const seed = dayKey(periodStart(period))
    return wait<BranchDemandResponse>({
      status: true,
      message: "Successful",
      data: [
        {
          branch_id: 1,
          branch_name: currentBranch().name,
          unit: "KVA",
          papr: 0.62,
          devices_demands: DEVICES.map((d) => {
            const max = d.kw * currentBranch().scale * (1.1 + noise(seed + d.device_id) * 0.3)
            return {
              device_name: d.name,
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

  blendedCost: (period: Period) =>
    wait<BlendedCostResponse>({
      status: true,
      message: "Successful",
      data: 230 + noise(dayKey(periodStart(period))) * 60,
    }),
}
