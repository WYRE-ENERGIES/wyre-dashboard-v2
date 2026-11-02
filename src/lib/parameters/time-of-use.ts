import type {
  TimeOfUseBranch,
  TimeOfUseResponse,
} from "@/lib/api/parameters-types"
import { formatDeviceName } from "@/lib/format"

/**
 * Time of Use page rules (old mainAppPages/TimeOfUse.js, smallComponents/
 * TimeOfUseCard.js, components/tables/TimeOfUseTable.js; inventory 03 §2).
 */

/** Hours each source ran in the period. Old TimeOfUseCard read
 * `usage_hours.{devices[], hours[]}`; the list form is accepted too. */
export function usageHours(branch: TimeOfUseBranch) {
  const raw = branch.usage_hours
  if (!raw) return []
  if (Array.isArray(raw))
    return raw.map((r) => ({ name: r.device_name, hours: r.hours ?? 0 }))
  return (raw.devices ?? []).map((name, i) => ({
    name,
    hours: raw.hours?.[i] ?? 0,
  }))
}

/**
 * Every branch of the organisation, the signed-in branch first. The old page
 * listed all branches in API order. Matching is by id, then by name.
 */
export function orderedBranches(
  data: TimeOfUseResponse | undefined,
  branchId: number,
  branchName?: string
) {
  const branches = data?.authenticatedData?.branches ?? []
  const isCurrent = (b: TimeOfUseBranch) =>
    b.branch_id === branchId ||
    b.id === branchId ||
    (!!branchName && b.name === branchName)
  const current = branches.find(isCurrent)
  return {
    current,
    others: branches.filter((b) => b !== current),
  }
}

export type TouColumnKind =
  "datetime" | "status" | "hours" | "cumulative" | "other"
export type TouColumn = {
  key: string
  label: string
  kind: TouColumnKind
  device?: string
}

// The backend spells the cumulative suffix several ways ("_hou_cummulative",
// "_hou_cummlative" in the old hard-coded CSV headers).
const CUMULATIVE = /_hou_cumm?ulative$|_hours?_cumulative$|_cumulative$/i

/**
 * Columns of the raw-log table, built from the response's own `titles`, with
 * readable headers. The old CSV headers were hard-coded to one client's
 * devices (EKEDC, 350KVA GEN) and the table showed raw keys.
 */
export function timeOfUseColumns(
  branch: TimeOfUseBranch,
  onlyDevices?: string[] | null
): TouColumn[] {
  const table = branch.time_of_use_table
  const titles = table?.titles?.length
    ? table.titles
    : Object.keys(table?.values?.[0] ?? {})
  const known = new Set([
    ...usageHours(branch).map((d) => d.name),
    ...(branch.devices ?? []).map((d) => d.name),
  ])
  const ownerOf = (title: string) => {
    if (known.has(title)) return title
    const base = title.replace(CUMULATIVE, "").replace(/_hours$/i, "")
    return base !== title ? base : undefined
  }

  return titles
    .map((key): TouColumn => {
      if (key === "post_datetime" || key === "date" || key === "datetime") {
        return { key, label: "Date/Time", kind: "datetime" }
      }
      const device = ownerOf(key)
      if (device && CUMULATIVE.test(key)) {
        return {
          key,
          label: `${formatDeviceName(device)} cumulative hours`,
          kind: "cumulative",
          device,
        }
      }
      if (device && /_hours$/i.test(key)) {
        return {
          key,
          label: `${formatDeviceName(device)} hours`,
          kind: "hours",
          device,
        }
      }
      if (device)
        return {
          key,
          label: `${formatDeviceName(device)} status`,
          kind: "status",
          device,
        }
      const text = key.replace(/_/g, " ").trim()
      return {
        key,
        label: text.charAt(0).toUpperCase() + text.slice(1),
        kind: "other",
      }
    })
    .filter((c) => c.key !== "index")
    .filter((c) => !onlyDevices || !c.device || onlyDevices.includes(c.device))
}
