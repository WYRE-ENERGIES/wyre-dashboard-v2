import { apiRequest } from "@/lib/api/client"
import type {
  BillFrequency,
  BillingResponse,
  MailSchedulesResponse,
} from "@/lib/api/billing-types"
import { DEMO } from "@/lib/demo"
import { demoBilling } from "@/lib/demo-data/billing"
import { endpointRange, type Period } from "@/lib/period"

// Billing endpoints are keyed by the user's id (JWT `id`), not the branch.
// The old app hard-coded backend.wyreng.com and, for billing_data, dropped the
// auth header; everything here goes through the authenticated client.

/** GET billing_data/{userId}/{start}/{end} (no trailing slash, as today). */
export const getBilling = (
  userId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoBilling.billing(period)
    : apiRequest<BillingResponse>(
        `billing_data/${userId}/${endpointRange(period)}`,
        { signal }
      )

export const getMailSchedules = (userId: number, signal?: AbortSignal) =>
  DEMO
    ? demoBilling.schedules()
    : apiRequest<MailSchedulesResponse>(`mail_schedules_data/${userId}/`, {
        signal,
      })

/** The mail-schedule writes answer with the updated `{data}` (old modal). */
const post = (path: string, body: object) =>
  apiRequest<MailSchedulesResponse>(path, { method: "POST", body })

export const addBillReceiver = (userId: number, email: string) =>
  DEMO
    ? demoBilling.addReceiver(email)
    : post(`add_external_bill_reciever/${userId}/`, { email })

export const removeBillReceiver = (userId: number, receiverId: number) =>
  DEMO
    ? demoBilling.removeReceiver(receiverId)
    : post(`delete_mail_reciever/${userId}/`, { receiver_id: receiverId })

/** One endpoint, three payloads: a receiver's devices, your own devices, or
 * your frequency (+ devices). */
export const assignBillDevices = (
  userId: number,
  body: {
    receiver_id?: number
    selected_devices: number[]
    frequency?: BillFrequency
  }
) =>
  DEMO
    ? demoBilling.assign(body)
    : post(`add_assigned_devices/${userId}/`, body)

/** "Send a bill now" for the period. */
export const sendBill = (
  userId: number,
  period: Period,
  email: string,
  selectedDevices: number[]
) =>
  DEMO
    ? demoBilling.send()
    : apiRequest<unknown>(`send_report/${userId}/${endpointRange(period)}/`, {
        method: "POST",
        body: { email, selected_devices: selectedDevices },
      })

/**
 * POST report_download/{userId}/{start}/{end}/ → PDF.
 * `apiRequest` parses every body as text/JSON, which corrupts binary files,
 * so this one call uses fetch directly with the same bearer header and
 * same-origin proxy (proposal: let apiRequest return a Blob).
 */
export async function downloadBillPdf(
  userId: number,
  period: Period,
  selectedDevices: number[]
): Promise<Blob> {
  if (DEMO) return demoBilling.pdf(period)
  return apiRequest<Blob>(
    `report_download/${userId}/${endpointRange(period)}/`,
    {
      method: "POST",
      body: { selected_devices: selectedDevices },
      responseType: "blob",
      accept: "application/pdf",
    }
  )
}
