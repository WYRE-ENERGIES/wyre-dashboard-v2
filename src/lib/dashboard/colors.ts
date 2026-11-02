/**
 * Chart colours: every series is a shade of the brand purple (chart-1…4,
 * darkest first). Solar sources take the brand yellow (chart-5) — the one
 * touch of yellow in the charts.
 */
export function seriesColors(
  devices: Array<{ device_type?: string; deviceType?: string }>
) {
  let shade = 0
  return devices.map((d) => {
    if ((d.device_type ?? d.deviceType) === "SOLAR") return "var(--chart-5)"
    return `var(--chart-${(shade++ % 4) + 1})`
  })
}
