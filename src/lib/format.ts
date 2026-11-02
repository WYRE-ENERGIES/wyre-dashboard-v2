/** Numbers always render as numbers: 0 is "0", never blank, NaN or Infinity
 * (inventory decision #5). */
export function formatNumber(value: number | null | undefined, digits = 2) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0
  return n.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function formatNaira(value: number | null | undefined) {
  return `₦${formatNumber(value)}`
}

/** Decimal hours → "16 h 20 min" (the old app's convertDecimalTimeToNormal). */
export function formatHours(decimalHours: number | null | undefined) {
  const total =
    typeof decimalHours === "number" && Number.isFinite(decimalHours)
      ? decimalHours
      : 0
  const hours = Math.floor(total)
  const minutes = Math.round((total - hours) * 60)
  if (minutes === 60) return `${hours + 1} h 0 min`
  return `${hours} h ${minutes} min`
}

export function formatPercent(part: number, whole: number) {
  if (!whole) return "0%"
  return `${formatNumber((part / whole) * 100, 1)}%`
}

/** Device names arrive as e.g. "GEN_500kVA (OLD)". */
export function formatDeviceName(name: string) {
  return name.replace(/_/g, " ")
}
