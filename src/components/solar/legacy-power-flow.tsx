"use client"

import type { FlowDirection, SolarLive } from "@/lib/api/solar-types"

/**
 * The power-flow diagram exactly as dashboard.wyreng.com draws it today
 * (old `FlowDiagram` in SolarOverviewPage.js on origin/dev): same geometry,
 * hard-coded colours, PNG icons (copied to /public/legacy-solar) and pulse
 * timing. Kept only so the new design can be compared with it in review;
 * it is light-only on purpose, like the original.
 */

type LegacyNode = {
  x: number
  y: number
  r: number
  color: string
  bg: string
  icon: string
  label: string
  value: string
  percentage?: number
  direction?: FlowDirection
  status?: string
  flowStatus?: string
  statusColor?: string
}

type Connector = {
  from: string
  side: "left" | "right"
  offset: number
}

const fixed2 = (n: number) => n.toFixed(2)

function buildLegacyNodes(live: SolarLive) {
  const { pv, battery, grid, load, generator } = live
  const showGenerator = generator.on

  const batteryKw = battery?.kw ?? 0
  const batteryDirection = battery?.direction ?? null
  const batteryStatus =
    batteryDirection === "OUT"
      ? "Discharging"
      : batteryDirection === "IN"
        ? "Charging"
        : batteryKw > 0
          ? "Discharging"
          : batteryKw < 0
            ? "Charging"
            : "Idle"
  const batteryStatusColor =
    batteryStatus === "Discharging"
      ? "#58B90A"
      : batteryStatus === "Charging"
        ? "#D7C6F3"
        : "#9ca3af"

  const nodes: Record<string, LegacyNode> = {
    production: {
      x: 300,
      y: 160,
      r: 62,
      color: "var(--lf-production)",
      bg: "var(--lf-production-bg)",
      icon: "/legacy-solar/production.png",
      label: "Production",
      value: `${fixed2(pv.kw)} kW`,
    },
    capacity: {
      x: -40,
      y: 50,
      r: 38,
      color: "var(--lf-capacity)",
      bg: "var(--lf-capacity-bg)",
      icon: "/legacy-solar/capacity.png",
      label: "Capacity",
      value: `${pv.capacityKwp} kWp`,
      percentage: pv.percent,
      direction: pv.direction,
    },
  }
  if (showGenerator) {
    nodes.generator = {
      x: -40,
      y: 160,
      r: 24,
      color: "var(--lf-generator)",
      bg: "var(--lf-generator-bg)",
      icon: "/legacy-solar/generator.svg",
      label: "Generator",
      value: `${fixed2(generator.kw)} kW`,
      direction: generator.direction,
      status: "ON",
      flowStatus: generator.kw > 0 ? "Supplying" : "Idle",
      statusColor: generator.kw > 0 ? "#ea580c" : "#9ca3af",
    }
  }
  nodes.battery = {
    x: -40,
    y: 270,
    r: 38,
    color: "var(--lf-battery)",
    bg: "var(--lf-battery-bg)",
    icon: "/legacy-solar/battery.png",
    label: "Battery",
    value: `${fixed2(Math.abs(batteryKw))} kW`,
    percentage: battery?.percent ?? 0,
    direction: batteryDirection,
    status: batteryStatus,
    statusColor: batteryStatusColor,
  }
  nodes.grid = {
    x: 660,
    y: 50,
    r: 38,
    color: "var(--lf-grid)",
    bg: "var(--lf-grid-bg)",
    icon: "/legacy-solar/grid.png",
    label: "Grid",
    value: `${fixed2(grid.kw)} kW`,
    direction: grid.direction,
    status: grid.on ? "ON" : "OFF",
  }
  nodes.usage = {
    x: 660,
    y: 270,
    r: 38,
    color: "var(--lf-usage)",
    bg: "var(--lf-usage-bg)",
    icon: "/legacy-solar/usage.png",
    label: "Usage",
    value: `${fixed2(load.kw)} kW`,
    direction: load.direction,
  }

  const connectors: Connector[] = [
    { from: "capacity", side: "left", offset: -28 },
    ...(showGenerator
      ? [{ from: "generator", side: "left", offset: -8 } as const]
      : []),
    { from: "battery", side: "left", offset: 12 },
    { from: "grid", side: "right", offset: -18 },
    { from: "usage", side: "right", offset: 22 },
  ]

  return { nodes, connectors, showGenerator }
}

/** IN = Production → node, OUT (or unset) = node → Production. */
function legacyPath(start: LegacyNode, end: LegacyNode, c: Connector) {
  let sx: number, sy: number, ex: number, ey: number
  if (start.direction === "IN") {
    sx = end.x + (c.side === "left" ? -end.r : end.r)
    sy = end.y + c.offset
    ex = start.x + (start.x < end.x ? start.r : -start.r)
    ey = start.y
  } else {
    sx = start.x + (start.x < end.x ? start.r : -start.r)
    sy = start.y
    ex = end.x + (c.side === "left" ? -end.r : end.r)
    ey = end.y + c.offset
  }
  const midX1 = sx + (ex - sx) * 0.25
  const midX2 = sx + (ex - sx) * 0.75
  return `M ${sx},${sy} Q ${(sx + midX1) / 2},${sy} ${midX1},${sy} L ${midX2},${ey} Q ${(midX2 + ex) / 2},${ey} ${ex},${ey}`
}

export function LegacyPowerFlow({ live }: { live: SolarLive }) {
  const { nodes, connectors, showGenerator } = buildLegacyNodes(live)
  const end = nodes.production

  return (
    // The old dashboard's white card; colours come from the --lf-* tokens in
    // globals.css, so dark mode gets a dark card with brighter line work.
    <div className="legacy-flow rounded-lg bg-card py-2">
      <svg
        width="100%"
        height="320"
        viewBox="-200 0 1000 320"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Power flow as drawn on the current Wyre dashboard"
      >
        <style>{`
          @keyframes wyre-legacy-flow { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
          .wyre-legacy-pulse { animation: wyre-legacy-flow 2.2s linear infinite; }
        `}</style>

        {connectors.map((c) => {
          const start = nodes[c.from]
          const isIdle = start.direction === "IDLE"
          const isSourceOff =
            start.status === "OFF" &&
            (c.from === "grid" || c.from === "generator")
          const d = legacyPath(start, end, c)
          return (
            <g key={c.from}>
              <path
                d={d}
                fill="none"
                stroke="var(--lf-line)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.45}
              />
              {!isIdle &&
                !isSourceOff &&
                [0, 0.6, 1.2].map((delay) => (
                  <path
                    key={delay}
                    d={d}
                    fill="none"
                    stroke={start.color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="12 260"
                    strokeDashoffset={300}
                    className="wyre-legacy-pulse"
                    style={{
                      animationDelay: `${delay}s`,
                      filter: `drop-shadow(0 0 6px color-mix(in srgb, ${start.color} 50%, transparent))`,
                    }}
                  />
                ))}
            </g>
          )
        })}

        {showGenerator && nodes.generator && (
          <line
            x1={nodes.capacity.x}
            y1={nodes.capacity.y + nodes.capacity.r}
            x2={nodes.generator.x}
            y2={nodes.generator.y - nodes.generator.r}
            stroke={nodes.capacity.color}
            strokeWidth={2.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
            opacity={0.72}
          />
        )}

        {Object.entries(nodes).map(([key, n]) => {
          const iconSize = n.r * 0.9
          let labelOffsetX = 0
          let textAnchor: "start" | "middle" | "end" = "middle"
          if (key === "capacity" || key === "battery" || key === "generator") {
            const labelR = key === "generator" ? nodes.capacity.r : n.r
            labelOffsetX = -labelR - 95
            textAnchor = "start"
          } else if (key === "grid" || key === "usage") {
            labelOffsetX = n.r + 95
            textAnchor = "end"
          }
          const pillOn = n.status === "ON"
          const hasRing =
            (key === "capacity" || key === "battery") &&
            n.percentage !== undefined
          const ring = 2 * Math.PI * (n.r + 5)

          return (
            <g key={key}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.bg}
                stroke={n.color}
                strokeWidth={2}
              />
              {hasRing && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r + 5}
                  fill="none"
                  stroke={n.color}
                  strokeWidth={4}
                  strokeDasharray={`${(ring * (n.percentage ?? 0)) / 100} ${ring}`}
                  strokeLinecap="round"
                  opacity={0.6}
                />
              )}
              {(key === "grid" || key === "generator") && (
                <g
                  transform={`translate(${n.x + n.r - 24}, ${n.y - n.r - 10})`}
                >
                  <rect
                    x={0}
                    y={0}
                    rx={10}
                    ry={10}
                    width={40}
                    height={18}
                    fill={pillOn ? "#22c55e" : "#ef4444"}
                    stroke="var(--card)"
                    strokeWidth={1.5}
                    style={{
                      filter: `drop-shadow(0 0 6px ${pillOn ? "#22c55e" : "#ef4444"})`,
                    }}
                  />
                  <text
                    x={20}
                    y={13}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="#ffffff"
                  >
                    {pillOn ? "ON" : "OFF"}
                  </text>
                </g>
              )}
              <image
                href={n.icon}
                x={n.x - iconSize / 2}
                y={n.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                preserveAspectRatio="xMidYMid meet"
              />
              {hasRing && (
                <text
                  x={n.x + (key === "capacity" ? n.r + 16 : n.r + 17)}
                  y={n.y - 10}
                  textAnchor="start"
                  fontSize={13}
                  fill={n.color}
                  fontWeight={600}
                >
                  {n.percentage}%
                </text>
              )}
              {key === "production" ? (
                <>
                  <text
                    x={n.x}
                    y={n.y - n.r - 18}
                    textAnchor="middle"
                    fontSize={13}
                    fill={n.color}
                    fontWeight={600}
                  >
                    {n.value}
                  </text>
                  <text
                    x={n.x}
                    y={n.y - n.r - 32}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--lf-caption)"
                  >
                    {n.label}
                  </text>
                </>
              ) : (
                <>
                  <text
                    x={n.x + labelOffsetX}
                    y={n.y - 34}
                    textAnchor={textAnchor}
                    fontSize={13}
                    fill="var(--lf-label)"
                    fontWeight={600}
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x + labelOffsetX}
                    y={n.y - 14}
                    textAnchor={textAnchor}
                    fontSize={12}
                    fill="var(--lf-value)"
                  >
                    {n.value}
                  </text>
                  {(key === "battery" || key === "generator") && (
                    <text
                      x={n.x + labelOffsetX}
                      y={n.y + 2}
                      textAnchor={textAnchor}
                      fontSize={11}
                      fontWeight={600}
                      fill={n.statusColor}
                    >
                      {key === "battery" ? n.status : n.flowStatus}
                    </text>
                  )}
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
