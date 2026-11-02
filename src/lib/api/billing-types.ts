/**
 * Billing shapes, inferred from the old helpers
 * (organizationDataHelpers.js:580-760, ScheduleEmailModal.js). Not verified
 * live: production never got past its refetch loop on the account walked
 * (inventory 00-live-walkthrough). Everything not used for layout is optional.
 */

export type BillTotal = {
  usage_kwh?: number | null
  value_naira?: number | null
}

export type BillingSeries = { dates?: string[]; values?: Array<number | null> }

export type BillingDevice = {
  id?: number
  device_id?: number
  name: string
  device_type?: string
  is_source?: boolean
  billing?: {
    consumption_kwh?: BillingSeries
    consumption_naira?: BillingSeries
    totals?: { present_total?: BillTotal; previous_total?: BillTotal }
  }
}

export type BillingBranch = {
  id?: number
  branch_id?: number
  name: string
  billing_totals?: {
    present_total?: BillTotal
    previous_total?: BillTotal
    usage?: {
      previous_kwh?: number
      present_kwh?: number
      total_usage_kwh?: number
    }
    metrics?: Record<string, number | string | null>
  }
  devices: BillingDevice[]
}

/** GET billing_data/{userId}/{start}/{end} → `authenticatedData`. */
export type BillingResponse = {
  status?: boolean
  message?: string
  authenticatedData: { name?: string; branches: BillingBranch[] }
}

export type BillFrequency = "WEEKLY" | "BI-WEEKLY" | "MONTHLY"

/** GET mail_schedules_data/{userId}/ → `data`. The backend spells "recievers". */
export type MailSchedules = {
  external_recievers?: Array<{
    id: number
    email: string
    assigned_devices?: Array<{ id: number; name?: string }>
  }>
  available_devices?: Array<{ device_id: number; device_name: string }>
  personal_data?: {
    assigned_devices?: Array<{ id: number; name?: string }>
    /** Not seen in the old code's reads; shown when present. */
    frequency?: BillFrequency | string | null
  }
}

export type MailSchedulesResponse = {
  data?: MailSchedules
  [key: string]: unknown
}
