import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getHours,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns"

import type {
  BaselineResponse,
  BranchOverviewResponse,
  DailyDieselEntry,
  DailyEntryInput,
  DieselOverviewResponse,
  DieselPurchase,
  DieselPurchaseInput,
  Equipment,
  EquipmentInput,
  EquipmentResponse,
  FuelConsumptionResponse,
  GeneratorsResponse,
  IppOverviewResponse,
  ListResponse,
  MonthlyDieselEntry,
  MonthlyEntryInput,
  Payment,
  PaymentInput,
  PaymentKind,
  UtilityOverviewResponse,
  UtilityOverviewRow,
} from "@/lib/api/cost-tracker-types"
import { ApiError } from "@/lib/api/client"
import {
  currentBranch,
  DEVICES,
  dayKey,
  hourlyKwh,
  noise,
  wait,
} from "@/lib/demo"

/**
 * Demo Cost Tracker: an in-memory store per demo branch, seeded from the same
 * hourly model as the dashboard (UTILITY, GEN_275kVA, GEN_65kVA,
 * Solar_Inverter), so diesel litres follow generator kWh and utility
 * purchases follow grid kWh. Writes change the store for the rest of the
 * session, and every overview is recomputed from it, so added, edited and
 * deleted rows show up everywhere.
 */

const HISTORY_MONTHS = 24
const KWH_PER_LITRE = 3.4
const VAT = 0.075
const GENERATORS = DEVICES.filter((d) => d.device_type === "GENERATOR")
const UTILITY = DEVICES.find((d) => d.device_type === "UTILITY")!

type FuelEntry = {
  id: number
  start_date: string
  end_date: string
  quantity: number
  record_time: string
  generator_id: number | null
  generator_name: string | null
  consumption_type: "Daily" | "Monthly"
}
type StoredPayment = Payment & { kind: PaymentKind }
type Store = {
  diesel: DieselPurchase[]
  payments: StoredPayment[]
  fuel: FuelEntry[]
  equipment: Equipment[]
}

const stores = new Map<number, Store>()
let nextId = 50_000
const iso = (d: Date) => format(d, "yyyy-MM-dd")
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

const kwhCache = new Map<string, { kwh: number; hours: number }>()
/** kWh and running hours of a device on a day (up to now for today). */
function dayUsage(device: (typeof DEVICES)[number], day: Date) {
  const branch = currentBranch().id
  const today = isSameDay(day, new Date())
  const key = `${branch}:${device.device_id}:${dayKey(day)}`
  const cached = !today && kwhCache.get(key)
  if (cached) return cached
  const lastHour = today ? getHours(new Date()) : 24
  let kwh = 0
  let hours = 0
  for (let h = 0; h < lastHour; h++) {
    const v = hourlyKwh(device, day, h)
    kwh += v
    if (v > 0) hours += 1
  }
  const usage = { kwh, hours }
  if (!today) kwhCache.set(key, usage)
  return usage
}

const dieselPrice = (d: Date) => {
  // ₦1,120/L two years ago drifting to about ₦1,300/L, with some noise.
  const monthsAgo =
    (new Date().getFullYear() - d.getFullYear()) * 12 +
    new Date().getMonth() -
    d.getMonth()
  return Math.round(1300 - monthsAgo * 7.5 + (noise(dayKey(d) + 7) - 0.5) * 60)
}
const gridTariff = (d: Date) =>
  round(206 + noise(dayKey(startOfMonth(d)) + 3) * 8)

function seed(): Store {
  const branch = currentBranch()
  const now = new Date()
  const start = startOfMonth(subMonths(now, HISTORY_MONTHS - 1))
  const yesterday = addDays(startOfDay(now), -1)
  const days = eachDayOfInterval({ start, end: yesterday })
  // Three older months were logged as monthly totals instead of daily entries.
  const monthlyMonths = new Set(
    [14, 15, 16].map((m) => format(subMonths(now, m), "yyyy-MM"))
  )

  const fuel: FuelEntry[] = []
  const diesel: DieselPurchase[] = []
  const payments: StoredPayment[] = []
  let sinceLastPurchase = 0
  let gridSincePayment = 0

  days.forEach((day, i) => {
    const seedN = dayKey(day) + branch.id * 1000
    for (const gen of GENERATORS) {
      const { kwh } = dayUsage(gen, day)
      const litres = Math.round(
        (kwh / KWH_PER_LITRE) * (0.88 + noise(seedN + gen.device_id) * 0.26)
      )
      sinceLastPurchase += litres
      // Operators skip a few days, like real data entry.
      if (
        litres <= 0 ||
        noise(seedN * 3 + gen.device_id) < 0.1 ||
        monthlyMonths.has(format(day, "yyyy-MM"))
      )
        continue
      fuel.push({
        id: nextId++,
        start_date: iso(day),
        end_date: iso(day),
        quantity: litres,
        record_time: new Date(day.getTime() + 33 * 3_600_000).toISOString(),
        generator_id: gen.device_id,
        generator_name: gen.name,
        consumption_type: "Daily",
      })
    }
    // Diesel delivered roughly every 10 days, rounded to 50 L.
    if (i % 10 === 3 && sinceLastPurchase > 0) {
      diesel.push({
        id: nextId++,
        date: iso(day),
        quantity: Math.max(
          200,
          Math.round((sinceLastPurchase * 1.05) / 50) * 50
        ),
        price_per_litre: dieselPrice(day),
        fuel_type: "diesel",
      })
      sinceLastPurchase = 0
    }
    gridSincePayment += dayUsage(UTILITY, day).kwh
    // Pre-paid tokens about weekly; Ikeja (branch 2) is billed post-paid monthly.
    if (branch.id !== 2 && i % 7 === 2 && gridSincePayment > 0) {
      const value = Math.round((gridSincePayment * 1.08) / 10) * 10
      const tariff = gridTariff(day)
      const amount = round(value * tariff)
      payments.push({
        id: nextId++,
        kind: "pre-paid",
        payment_type: "pre-paid",
        date: iso(day),
        value,
        tarrif: tariff,
        amount,
        vat_inclusive_amount: round(amount * (1 + VAT)),
      })
      gridSincePayment = 0
    }
    if (branch.id === 2 && isSameDay(day, endOfMonth(day))) {
      const value = Math.round(gridSincePayment)
      const tariff = gridTariff(day)
      const amount = round(value * tariff)
      payments.push({
        id: nextId++,
        kind: "post-paid",
        payment_type: "post-paid",
        date: iso(startOfMonth(day)),
        end_date: iso(day),
        value,
        tarrif: tariff,
        amount,
        vat_inclusive_amount: round(amount * (1 + VAT)),
      })
      gridSincePayment = 0
    }
    // IPP (shown to resellers only): a monthly bill on the 1st.
    if (day.getDate() === 1 && i > 0) {
      const value = Math.round(
        4200 * branch.scale * (0.9 + noise(seedN + 11) * 0.2)
      )
      const tariff = round(185 + noise(seedN + 13) * 10)
      const amount = round(value * tariff)
      payments.push({
        id: nextId++,
        kind: "ipp",
        payment_type: "ipp",
        date: iso(day),
        value,
        tarrif: tariff,
        amount,
        vat_inclusive_amount: round(amount * (1 + VAT)),
      })
    }
  })

  for (const key of monthlyMonths) {
    const month = new Date(`${key}-01T00:00:00`)
    const litres = eachDayOfInterval({
      start: month,
      end: endOfMonth(month),
    }).reduce(
      (total, day) =>
        total +
        GENERATORS.reduce(
          (t, g) => t + dayUsage(g, day).kwh / KWH_PER_LITRE,
          0
        ),
      0
    )
    fuel.push({
      id: nextId++,
      start_date: iso(month),
      end_date: iso(endOfMonth(month)),
      quantity: round(litres * 1.04),
      record_time: addDays(endOfMonth(month), 1).toISOString(),
      generator_id: null,
      generator_name: null,
      consumption_type: "Monthly",
    })
  }

  // Yesterday's main-generator entry was "recorded" a few minutes ago, so
  // the 30-minute edit window can be tried straight away.
  const recent = [...fuel].reverse().find((e) => e.consumption_type === "Daily")
  if (recent)
    recent.record_time = new Date(Date.now() - 6 * 60_000).toISOString()

  const equipment: Equipment[] = [
    ["Split AC 2HP", 1800, 6, 420],
    ["Chest freezer", 350, 3, 300],
    ["LED panel light", 40, 48, 600],
    ["Desktop computer", 250, 12, 380],
    ["Water pump", 1100, 1, 720],
    ["CCTV system", 120, 1, 200],
  ].map(([name, voltage, quantity, daysAgo]) => ({
    id: nextId++,
    name: name as string,
    voltage: voltage as number,
    quantity: Math.max(1, Math.round((quantity as number) * branch.scale)),
    date_purchased: iso(addDays(now, -(daysAgo as number))),
    branch_id: branch.id,
  }))

  return { diesel, payments, fuel, equipment }
}

function store() {
  const id = currentBranch().id
  let s = stores.get(id)
  if (!s) {
    s = seed()
    stores.set(id, s)
  }
  return s
}

const historyMonths = () => {
  const now = new Date()
  return eachMonthOfInterval({
    start: startOfMonth(subMonths(now, HISTORY_MONTHS - 1)),
    end: now,
  }).reverse()
}
const inMonth = (date: string, month: Date) =>
  date.slice(0, 7) === format(month, "yyyy-MM")
const ok = <T>(data: T) => ({ status: true, message: "Successful", data })

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      current_page: page,
      page_size: pageSize,
      total_count: total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

function monthUsage(device: (typeof DEVICES)[number], month: Date) {
  const now = new Date()
  const end = endOfMonth(month) > now ? now : endOfMonth(month)
  return eachDayOfInterval({ start: month, end }).reduce(
    (t, d) => t + dayUsage(device, d).kwh,
    0
  )
}

function utilityRows(kind: "utility" | "ipp"): UtilityOverviewRow[] {
  const s = store()
  return historyMonths().map((month) => {
    const paid = s.payments.filter(
      (p) =>
        (kind === "ipp" ? p.kind === "ipp" : p.kind !== "ipp") &&
        inMonth(p.date, month)
    )
    const purchasedKwh = paid.reduce((t, p) => t + Number(p.value), 0)
    const purchasedNaira = paid.reduce((t, p) => t + Number(p.amount), 0)
    const tariff = purchasedKwh
      ? purchasedNaira / purchasedKwh
      : kind === "ipp"
        ? 190
        : gridTariff(month)
    // IPP supply is modelled as a share of the generator load it replaces.
    const consumed =
      kind === "ipp"
        ? monthUsage(GENERATORS[0], month) * 1.4
        : monthUsage(UTILITY, month)
    const diffKwh = purchasedKwh - consumed
    return {
      month: format(month, "MMMM yyyy"),
      purchased_kwh: round(purchasedKwh),
      energy_consumed_kwh: round(consumed),
      purchased_naira: round(purchasedNaira),
      energy_consumed_naira: round(consumed * tariff),
      difference_kwh: round(diffKwh),
      difference_naira: round(diffKwh * tariff),
      percentage: purchasedKwh ? round((diffKwh / purchasedKwh) * 100) : 0,
    }
  })
}

function genName(id: number | undefined) {
  return GENERATORS.find((g) => g.device_id === id)?.name ?? null
}

function find<T extends { id: number }>(rows: T[], id: number) {
  const row = rows.find((r) => r.id === id)
  if (!row) throw new ApiError("Record not found", 404, null)
  return row
}

const toDaily = (e: FuelEntry): DailyDieselEntry => ({
  id: e.id,
  start_date: e.start_date,
  end_date: e.end_date,
  quantity: e.quantity,
  record_time: e.record_time,
  generator_name: e.generator_name,
  device_id: e.generator_id,
})

export const demoCostTracker = {
  branchOverview: () => {
    const s = store()
    const strip = ({ kind: _kind, ...p }: StoredPayment) => p
    return wait<BranchOverviewResponse>(
      ok({
        branch_name: currentBranch().name,
        branch_data: {
          diesel: s.diesel.map((d) => ({ ...d })),
          utility: s.payments.filter((p) => p.kind !== "ipp").map(strip),
          ipp: s.payments.filter((p) => p.kind === "ipp").map(strip),
        },
      })
    )
  },

  dieselOverview: (page: number, pageSize: number) => {
    const s = store()
    const rows = historyMonths().map((month) => {
      const input = s.fuel
        .filter((e) => inMonth(e.start_date, month))
        .reduce((t, e) => t + e.quantity, 0)
      const forecast =
        GENERATORS.reduce((t, g) => t + monthUsage(g, month), 0) / KWH_PER_LITRE
      const bought = s.diesel.filter((d) => inMonth(d.date, month))
      const price = bought.length
        ? bought.reduce((t, d) => t + Number(d.price_per_litre), 0) /
          bought.length
        : dieselPrice(month)
      const diff = input - forecast
      return {
        month: format(month, "MMMM yyyy"),
        inputted_usage: round(input),
        forecasted_usage: round(forecast),
        inputted_cost: round(input * price),
        forecasted_cost: round(forecast * price),
        diesel_difference: round(diff),
        cost_difference: round(diff * price),
        percentage_usage: forecast ? round((diff / forecast) * 100) : 0,
      }
    })
    const { rows: pageRows, pagination } = paginate(rows, page, pageSize)
    return wait<DieselOverviewResponse>({
      ...ok({ diesel_overview: pageRows }),
      pagination,
    })
  },

  utilityOverview: (page: number, pageSize: number) => {
    const { rows, pagination } = paginate(
      utilityRows("utility"),
      page,
      pageSize
    )
    return wait<UtilityOverviewResponse>({
      ...ok({ utility_overview: rows }),
      pagination,
    })
  },

  ippOverview: () =>
    wait<IppOverviewResponse>(ok({ ipp_overview: utilityRows("ipp") })),

  baseline: () =>
    wait<BaselineResponse>(
      ok({
        branch_name: currentBranch().name,
        baseline: Object.fromEntries(
          DEVICES.map((device) => [
            device.name,
            historyMonths().map((month) => {
              const used = monthUsage(device, month)
              return {
                date: format(month, "yyyy-MM-dd"),
                used: round(used),
                forecast: round(
                  used * (0.92 + noise(dayKey(month) + device.device_id) * 0.2)
                ),
              }
            }),
          ])
        ),
      })
    ),

  fuelConsumption: (year: number, month: number) => {
    const s = store()
    const first = new Date(year, month - 1, 1)
    const rows = s.fuel
      .filter((e) => inMonth(e.start_date, first))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((e) => {
        const gen = GENERATORS.find((g) => g.device_id === e.generator_id)
        const usage = gen
          ? dayUsage(gen, new Date(`${e.start_date}T00:00:00`))
          : { kwh: 0, hours: 0 }
        return {
          fuel_consumption_id: e.id,
          date: e.start_date,
          end_date: e.end_date,
          quantity: e.quantity,
          hours_of_use: e.consumption_type === "Daily" ? usage.hours : 0,
          record_time: e.record_time,
          generator_name: e.generator_name,
          device_id: e.generator_id,
          energy_consumed: gen ? { [gen.name]: round(usage.kwh) } : {},
          litres_per_hour:
            gen && usage.hours
              ? { [gen.name]: round(e.quantity / usage.hours) }
              : {},
        }
      })
    return wait<FuelConsumptionResponse>({
      ...ok(rows),
      branch_id: currentBranch().id,
      branch_name: currentBranch().name,
    })
  },

  generators: () =>
    wait<GeneratorsResponse>({
      generators: GENERATORS.map((g) => ({
        id: g.id,
        device_id: g.device_id,
        name: g.name,
      })),
    }),

  dailyUsage: () =>
    wait<ListResponse<DailyDieselEntry>>(
      ok(
        store()
          .fuel.filter((e) => e.consumption_type === "Daily")
          .map(toDaily)
      )
    ),

  monthlyUsage: () =>
    wait<ListResponse<MonthlyDieselEntry>>(
      ok(
        store()
          .fuel.filter((e) => e.consumption_type === "Monthly")
          .map((e) => {
            const d = new Date(`${e.start_date}T00:00:00`)
            return {
              id: e.id,
              month: format(d, "MMMM"),
              year: d.getFullYear(),
              quantity: e.quantity,
              record_time: e.record_time,
              start_date: e.start_date,
              end_date: e.end_date,
            }
          })
      )
    ),

  equipments: () => {
    const branch = currentBranch()
    return wait<EquipmentResponse>(
      ok({
        [branch.name]: {
          id: branch.id,
          name: branch.name,
          equipments: store().equipment.map((e) => ({ ...e })),
        },
      })
    )
  },

  // ---- Writes ----

  addDieselPurchase: (input: DieselPurchaseInput) => {
    store().diesel.push({ id: nextId++, fuel_type: "diesel", ...input })
    return wait(ok(null))
  },
  updateDieselPurchase: (id: number, input: DieselPurchaseInput) => {
    Object.assign(find(store().diesel, id), input)
    return wait(ok(null))
  },
  deleteDieselPurchase: (id: number) => {
    const s = store()
    find(s.diesel, id)
    s.diesel = s.diesel.filter((d) => d.id !== id)
    return wait(ok(null))
  },

  addPayment: (kind: PaymentKind, input: PaymentInput) => {
    const { tariff, ...rest } = input
    store().payments.push({
      id: nextId++,
      kind,
      payment_type: kind,
      ...rest,
      tarrif: tariff,
      vat_inclusive_amount: round(input.amount * (1 + VAT)),
    })
    return wait(ok(null))
  },
  updatePayment: (kind: PaymentKind, id: number, input: PaymentInput) => {
    const { tariff, ...rest } = input
    Object.assign(find(store().payments, id), {
      kind,
      payment_type: kind,
      ...rest,
      tarrif: tariff,
      vat_inclusive_amount: round(input.amount * (1 + VAT)),
    })
    return wait(ok(null))
  },
  deletePayment: (id: number) => {
    const s = store()
    find(s.payments, id)
    s.payments = s.payments.filter((p) => p.id !== id)
    return wait(ok(null))
  },

  addDailyEntry: (input: DailyEntryInput) => {
    store().fuel.push({
      id: nextId++,
      start_date: input.start_date,
      end_date: input.end_date,
      quantity: input.quantity,
      record_time: new Date().toISOString(),
      generator_id: input.generator_id ?? null,
      generator_name: genName(input.generator_id),
      consumption_type: "Daily",
    })
    return wait({ status: true, message: "Created" })
  },
  addMonthlyEntry: (input: MonthlyEntryInput) => {
    store().fuel.push({
      id: nextId++,
      ...input,
      record_time: new Date().toISOString(),
      generator_id: null,
      generator_name: null,
      consumption_type: "Monthly",
    })
    return wait({ status: true, detail: "Created" })
  },
  updateFuelEntry: (id: number, input: DailyEntryInput | MonthlyEntryInput) => {
    const entry = find(store().fuel, id)
    Object.assign(entry, {
      start_date: input.start_date,
      end_date: input.end_date,
      quantity: input.quantity,
    })
    if ("generator_id" in input && input.generator_id) {
      entry.generator_id = input.generator_id
      entry.generator_name = genName(input.generator_id)
    }
    return wait({ status: true, detail: "Updated" })
  },
  deleteFuelEntry: (id: number) => {
    const s = store()
    find(s.fuel, id)
    s.fuel = s.fuel.filter((e) => e.id !== id)
    return wait({ status: true, detail: "Deleted" })
  },

  addEquipment: (input: EquipmentInput) => {
    store().equipment.push({
      id: nextId++,
      branch_id: currentBranch().id,
      ...input,
    })
    return wait(ok(null))
  },
  editEquipment: (id: number, input: EquipmentInput) => {
    Object.assign(find(store().equipment, id), input)
    return wait(ok(null))
  },
  deleteEquipment: (id: number) => {
    const s = store()
    find(s.equipment, id)
    s.equipment = s.equipment.filter((e) => e.id !== id)
    return wait(ok(null))
  },
}
