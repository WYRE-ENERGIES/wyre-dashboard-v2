/**
 * Chart colours for energy sources, in a fixed order: purple, cyan, yellow,
 * blue, coral. Solar always takes the brand yellow (chart-5); when a solar
 * source is present the other sources skip yellow so it stays unique.
 */
const ORDER = [1, 2, 5, 3, 4]

export function seriesColors(
  devices: Array<{ device_type?: string; deviceType?: string }>
) {
  const isSolar = (d: (typeof devices)[number]) =>
    (d.device_type ?? d.deviceType) === "SOLAR"
  const order = devices.some(isSolar) ? ORDER.filter((n) => n !== 5) : ORDER
  let next = 0
  return devices.map((d) =>
    isSolar(d)
      ? "var(--chart-5)"
      : `var(--chart-${order[next++ % order.length]})`
  )
}
