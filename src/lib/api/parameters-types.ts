/**
 * Response shapes of the Parameters endpoints (inventory 03 §1–§5, 06 §2.3).
 *
 * NOT verified live: these were inferred from the old app's code
 * (mainAppPages/{EnergyConsumption,PowerQuality,PowerDemand,LastReading,TimeOfUse}.js)
 * and the captured payload `authenticatedData.json` in the old repo, so most
 * fields are optional and every reader tolerates a missing one.
 */

/** A device as the parameter endpoints return it. `device_id` is what the
 * global device filter matches on (old `devicesArray`). */
export type ParamDeviceBase = {
  id?: number
  device_id?: number
  name: string
  device_type?: string
  is_source?: boolean
  is_load?: boolean
}

/**
 * The four branch-scoped endpoints wrap one branch in `authenticatedData`.
 * The old pages read `authenticatedData.devices` directly (they pass it to
 * `devicesArray` as the branch); some responses may instead nest it in
 * `branches[0]`, so both are accepted (see `branchDevices`).
 */
export type BranchEnvelope<TDevice> = {
  status?: boolean
  message?: string
  authenticatedData?: {
    id?: number
    name?: string
    devices?: TDevice[]
    branches?: Array<{ id?: number; name?: string; devices?: TDevice[] }>
  }
}

type DateList = { dates?: string[]; units?: string }

/** GET dashboard/energy_consumption/{branch}/{start}/{end}/{interval} */
export type EnergyConsumptionDevice = ParamDeviceBase & {
  energy_consumption?: {
    /** Meter reading at the start of the range (kWh). */
    previous?: number | null
    /** Meter reading at the end of the range (kWh). */
    current?: number | null
    usage?: number | null
    dates?: DateList
    energy_consumption_values?: { value?: Array<number | null>; units?: string }
  }
}
export type EnergyConsumptionResponse = BranchEnvelope<EnergyConsumptionDevice>

/** Per-phase series, e.g. `voltage: {l1[], l2[], l3[], neutral[], units: "volts"}`. */
export type PhaseSeries = {
  l1?: Array<number | null>
  l2?: Array<number | null>
  l3?: Array<number | null>
  neutral?: Array<number | null>
  units?: string
}

/** GET dashboard/power_quality/{branch}/{start}/{end}/{interval} */
export type PowerQualityDevice = ParamDeviceBase & {
  power_quality?: {
    dates?: DateList
    voltage?: PhaseSeries
    current?: PhaseSeries
    active_power?: PhaseSeries
    reactive_power?: PhaseSeries
    frequency?: { average?: Array<number | null>; units?: string }
    power_factor?: { l1_l2_l3?: Array<number | null>; units?: string }
    power_factor123?: PhaseSeries
  }
}
export type PowerQualityResponse = BranchEnvelope<PowerQualityDevice>

/** GET dashboard/power_demand/{branch}/{start}/{end}/{interval} */
export type PowerDemandDevice = ParamDeviceBase & {
  power_demand?: {
    dates?: DateList
    power_demand_values?: {
      demand?: Array<number | null>
      min?: Array<number | null>
      max?: Array<number | null>
      avg?: Array<number | null>
      /** "kW" in the captured payload; may be "kVA". */
      units?: string
    }
  }
}
export type PowerDemandResponse = BranchEnvelope<PowerDemandDevice>

export type PhaseReading = {
  name: string
  l1?: number | null
  l2?: number | null
  l3?: number | null
  unit?: string
}
export type ValueReading = {
  name: string
  value?: number | null
  unit?: string
}

/** GET dashboard/last_reading/{branch}/{DD-MM-YYYY HH:mm} */
export type LastReadingDevice = ParamDeviceBase & {
  last_reading?: {
    /** When the meter took the reading, e.g. "2021-05-20T12:33:18.327". */
    date?: string | null
    data?: {
      phase_measures?: PhaseReading[]
      totals?: ValueReading[]
      harmonic_distortion?: PhaseReading[]
      energy?: ValueReading[]
      demands?: PhaseReading[]
      total_demands?: ValueReading[]
    }
  }
}
export type LastReadingResponse = BranchEnvelope<LastReadingDevice>

/**
 * GET dashboard/{userId}/{start}/{end}/{interval} — the old app's global
 * "organisation" payload (services/devices.js `getAllData`). Time of Use reads
 * each branch's `usage_hours` and `time_of_use_table`.
 */
export type TimeOfUseBranch = {
  id?: number
  branch_id?: number
  name: string
  devices?: ParamDeviceBase[]
  /** Old TimeOfUseCard: `{devices: string[], hours: number[]}`. The captured
   * payload also has a list form `[{device_name, hours}]`; both are read. */
  usage_hours?:
    | { devices?: string[]; hours?: Array<number | null> }
    | Array<{ device_name: string; hours: number | null }>
  time_of_use_table?: {
    /** Column keys, e.g. ["post_datetime", "EKEDC", "EKEDC_hours", "EKEDC_hou_cummulative", …]. */
    titles?: string[]
    values?: Array<Record<string, string | number | null>>
    sums?: Record<string, number | null>
  }
}
export type TimeOfUseResponse = {
  status?: boolean
  message?: string
  authenticatedData?: {
    id?: number
    name?: string
    branches?: TimeOfUseBranch[]
  }
}
