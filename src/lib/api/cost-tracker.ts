import { apiRequest } from "@/lib/api/client"
import type {
  BaselineResponse,
  BranchOverviewResponse,
  DailyDieselEntry,
  DailyEntryInput,
  DieselOverviewResponse,
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
  PaymentInput,
  PaymentKind,
  UtilityOverviewResponse,
} from "@/lib/api/cost-tracker-types"
import { DEMO } from "@/lib/demo"
import { demoCostTracker as demo } from "@/lib/demo-data/cost-tracker"

/**
 * Cost Tracker endpoints, used as they are today (inventory 06 §2.8–2.9).
 * `branchId` is the selected (sidebar) branch, i.e. the session's
 * `branch_id`, never `branches[0]` as in the old app. Writes keyed by user
 * take the JWT's `user_id`, like the old tables and forms.
 *
 * None of these endpoints take a date range: the overviews return the last
 * 12 months and the registers return every row, so the page filters them to
 * the global period on the client (see `@/lib/cost-tracker/rules`).
 */

/** Large enough to get every month the overview endpoints return in one page. */
const ALL_MONTHS = 100

// ---- Reads ----

export const getBranchOverview = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.branchOverview()
    : apiRequest<BranchOverviewResponse>(
        `cost-tracker/branch-overview/${branchId}`,
        { signal }
      )

export const getDieselOverview = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.dieselOverview(1, ALL_MONTHS)
    : apiRequest<DieselOverviewResponse>(
        `cost-tracker/diesel-overview/${branchId}/?page=1&page_size=${ALL_MONTHS}`,
        { signal }
      )

export const getUtilityOverview = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.utilityOverview(1, ALL_MONTHS)
    : apiRequest<UtilityOverviewResponse>(
        `cost-tracker/utility-overview/${branchId}/?page=1&page_size=${ALL_MONTHS}`,
        { signal }
      )

/** Never called by the old app (its IPP tables were always empty). Shape inferred. */
export const getIppOverview = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.ippOverview()
    : apiRequest<IppOverviewResponse>(`cost-tracker/ipp-overview/${branchId}`, {
        signal,
      })

export const getBaseline = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.baseline()
    : apiRequest<BaselineResponse>(`cost-tracker/baseline/${branchId}`, {
        signal,
      })

/** Month drill-down. Production (07 §6) calls it with the branch id, the
 * month not zero-padded and a trailing slash. */
export const getFuelConsumption = (
  branchId: number,
  year: number,
  month: number,
  signal?: AbortSignal
) =>
  DEMO
    ? demo.fuelConsumption(year, month)
    : apiRequest<FuelConsumptionResponse>(
        `diesel_tracker_overview/${branchId}/${year}/${month}/`,
        { signal }
      )

export const getGenerators = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.generators()
    : apiRequest<GeneratorsResponse>(`branch/${branchId}/generators/`, {
        signal,
      })

export const getDailyDieselUsage = (branchId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.dailyUsage()
    : apiRequest<ListResponse<DailyDieselEntry>>(
        `cost-tracker/diesel-daily-usage/${branchId}`,
        { signal }
      )

export const getMonthlyDieselUsage = (
  branchId: number,
  signal?: AbortSignal
) =>
  DEMO
    ? demo.monthlyUsage()
    : apiRequest<ListResponse<MonthlyDieselEntry>>(
        `cost-tracker/diesel-monthly-usage/${branchId}`,
        { signal }
      )

/** All of the user's branches; the page keeps the selected branch's list. */
export const getEquipments = (userId: number, signal?: AbortSignal) =>
  DEMO
    ? demo.equipments()
    : apiRequest<EquipmentResponse>(`equipments/${userId}/`, { signal })

// ---- Bills: diesel purchases, utility and IPP payments ----

export const addDieselPurchase = (
  userId: number,
  branchId: number,
  input: DieselPurchaseInput
) =>
  DEMO
    ? demo.addDieselPurchase(input)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/diesel/`, {
        method: "POST",
        body: { branch: branchId, ...input },
      })

export const updateDieselPurchase = (
  userId: number,
  branchId: number,
  id: number,
  input: DieselPurchaseInput
) =>
  DEMO
    ? demo.updateDieselPurchase(id, input)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/diesel/`, {
        method: "PUT",
        body: { branch: branchId, id, ...input, fuelType: "diesel" },
      })

/** The old app passed `{id}` as axios' config, so no body was ever sent;
 * this sends the intended `{id}` body. */
export const deleteDieselPurchase = (userId: number, id: number) =>
  DEMO
    ? demo.deleteDieselPurchase(id)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/diesel/`, {
        method: "DELETE",
        body: { id },
      })

/** `kind` picks the path: pre-paid, post-paid (sends `end_date`) or ipp. */
export const addPayment = (
  userId: number,
  branchId: number,
  kind: PaymentKind,
  input: PaymentInput
) =>
  DEMO
    ? demo.addPayment(kind, input)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/${kind}/`, {
        method: "POST",
        body: { branch: branchId, ...input },
      })

export const updatePayment = (
  userId: number,
  branchId: number,
  kind: PaymentKind,
  id: number,
  input: PaymentInput
) =>
  DEMO
    ? demo.updatePayment(kind, id, input)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/${kind}/`, {
        method: "PUT",
        body: { branch: branchId, id, ...input },
      })

/** Deletes on the payment's own path. The old app sent IPP (and post-paid)
 * deletes to the pre-paid path. */
export const deletePayment = (userId: number, kind: PaymentKind, id: number) =>
  DEMO
    ? demo.deletePayment(id)
    : apiRequest<unknown>(`cost_tracker/${userId}/add_cost/${kind}/`, {
        method: "DELETE",
        body: { id },
      })

// ---- Diesel consumption entries ----

export const addDailyDieselEntry = (
  branchId: number,
  input: DailyEntryInput
) =>
  DEMO
    ? demo.addDailyEntry(input)
    : apiRequest<unknown>(`fuel-entry/${branchId}/`, {
        method: "POST",
        body: {
          quantity: input.quantity,
          start_date: input.start_date,
          end_date: input.end_date,
          fuel_type: "diesel",
          generator_ids: input.generator_id ? [input.generator_id] : [],
          consumption_type: "Daily",
        },
      })

export const addMonthlyDieselEntry = (
  branchId: number,
  input: MonthlyEntryInput
) =>
  DEMO
    ? demo.addMonthlyEntry(input)
    : apiRequest<unknown>(`monthly-fuel-entry/${branchId}/`, {
        method: "POST",
        body: {
          branch: branchId,
          ...input,
          fuel_type: "diesel",
          consumption_type: "Monthly",
        },
      })

/**
 * PATCH fuel-entry/{entryId}/. The old app put the branch id in the URL and
 * the entry id in the body; this uses the entry id for both (unverified
 * against the backend — see the report).
 */
export const updateDieselEntry = (
  entryId: number,
  input:
    | (DailyEntryInput & { type: "Daily" })
    | (MonthlyEntryInput & { type: "Monthly" })
) =>
  DEMO
    ? demo.updateFuelEntry(entryId, input)
    : apiRequest<unknown>(`fuel-entry/${entryId}/`, {
        method: "PATCH",
        body: {
          quantity: input.quantity,
          start_date: input.start_date,
          end_date: input.end_date,
          consumption_type: input.type,
          entry_id: entryId,
          ...(input.type === "Daily"
            ? {
                fuel_type: "diesel",
                generator_ids: input.generator_id ? [input.generator_id] : [],
              }
            : {}),
        },
      })

export const deleteDieselEntry = (entryId: number) =>
  DEMO
    ? demo.deleteFuelEntry(entryId)
    : apiRequest<unknown>(`delete-fuel-entry/${entryId}/`, {
        method: "DELETE",
        body: { id: entryId },
      })

// ---- Equipment ----

export const addEquipment = (
  userId: number,
  branchId: number,
  input: EquipmentInput
) =>
  DEMO
    ? demo.addEquipment(input)
    : apiRequest<unknown>(`branch/${branchId}/${userId}/add_equipment/`, {
        method: "POST",
        body: input,
      })

export const editEquipment = (
  userId: number,
  branchId: number,
  id: number,
  input: EquipmentInput
) =>
  DEMO
    ? demo.editEquipment(id, input)
    : apiRequest<unknown>(
        `branch/${branchId}/${userId}/edit_equipment/${id}/`,
        { method: "POST", body: input }
      )

/** The old app posted the row (minus key/id/branch_id) to the delete path. */
export const deleteEquipment = (
  userId: number,
  branchId: number,
  row: Equipment
) =>
  DEMO
    ? demo.deleteEquipment(row.id)
    : apiRequest<unknown>(
        `branch/${branchId}/${userId}/edit_equipment/${row.id}/delete/`,
        {
          method: "POST",
          body: {
            name: row.name,
            voltage: row.voltage,
            quantity: row.quantity,
            date_purchased: row.date_purchased,
          },
        }
      )
