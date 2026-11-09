"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import {
  BatteryMediumIcon,
  FactoryIcon,
  FuelIcon,
  type LucideIcon,
  SunIcon,
  UtilityPoleIcon,
  ZapIcon,
} from "lucide-react"

import { CardError, InfoHint } from "@/components/shared/card-parts"
import { LegacyPowerFlow } from "@/components/solar/legacy-power-flow"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FlowDirection, SolarLive } from "@/lib/api/solar-types"
import { formatNumber } from "@/lib/format"
import {
  batteryStatus,
  connectorFlow,
  type FlowAnimation,
  generatorFlowStatus,
} from "@/lib/solar/metrics"

type NodeKey =
  "production" | "capacity" | "generator" | "battery" | "grid" | "usage"

type FlowNode = {
  key: NodeKey
  label: string
  value: string
  color: string
  Icon: LucideIcon
  /** Ring around the node (capacity used, battery SOC). */
  percent?: number
  /** ON/OFF pill (grid, generator). */
  on?: boolean
  status?: string
  direction?: FlowDirection
  /** Grid/generator connectors don't animate while OFF. */
  sourceOff?: boolean
}

type Point = { x: number; y: number; r: number }

/** Wide layout for tablets and up; tall layout for phones (375 px). */
const LAYOUTS: Record<
  "wide" | "tall",
  { viewBox: string; nodes: Record<NodeKey, Point> }
> = {
  wide: {
    // Wider than tall so the side nodes sit well apart from the hub.
    viewBox: "0 0 960 430",
    nodes: {
      production: { x: 480, y: 205, r: 56 },
      capacity: { x: 130, y: 60, r: 36 },
      generator: { x: 130, y: 205, r: 28 },
      battery: { x: 130, y: 345, r: 36 },
      grid: { x: 830, y: 60, r: 36 },
      usage: { x: 830, y: 345, r: 36 },
    },
  },
  tall: {
    viewBox: "0 0 360 610",
    nodes: {
      production: { x: 180, y: 300, r: 48 },
      capacity: { x: 72, y: 70, r: 34 },
      generator: { x: 72, y: 300, r: 26 },
      battery: { x: 72, y: 520, r: 34 },
      grid: { x: 288, y: 70, r: 34 },
      usage: { x: 288, y: 520, r: 34 },
    },
  },
}

/** Nodes from `solar/live` (07 §2.5; old FlowDiagram). */
function buildNodes(live: SolarLive): FlowNode[] {
  const nodes: FlowNode[] = [
    {
      key: "production",
      label: "Production",
      value: `${formatNumber(live.pv.kw)} kW`,
      color: "var(--chart-5)",
      Icon: SunIcon,
    },
    {
      key: "capacity",
      label: "Capacity",
      value: `${formatNumber(live.pv.capacityKwp, 1)} kWp`,
      color: "var(--chart-1)",
      Icon: ZapIcon,
      percent: live.pv.percent,
      direction: live.pv.direction,
    },
    {
      key: "grid",
      label: "Grid",
      value: `${formatNumber(live.grid.kw)} kW`,
      color: "var(--chart-3)",
      Icon: UtilityPoleIcon,
      on: live.grid.on,
      direction: live.grid.direction,
      sourceOff: !live.grid.on,
    },
    {
      key: "usage",
      label: "Usage",
      value: `${formatNumber(live.load.kw)} kW`,
      // Node colours follow the old dashboard: purple capacity, yellow
      // production, blue grid, green battery, red usage.
      color: "var(--destructive)",
      Icon: FactoryIcon,
      direction: live.load.direction,
    },
  ]
  if (live.battery) {
    nodes.push({
      key: "battery",
      label: "Battery",
      // Shown as a magnitude; the status says which way it flows.
      value: `${formatNumber(Math.abs(live.battery.kw))} kW`,
      color: "var(--success)",
      Icon: BatteryMediumIcon,
      percent: live.battery.percent,
      status: batteryStatus(live.battery.direction, live.battery.kw),
      direction: live.battery.direction,
    })
  }
  // The generator only appears while it is ON.
  if (live.generator.on) {
    nodes.push({
      key: "generator",
      label: "Generator",
      value: `${formatNumber(live.generator.kw)} kW`,
      color: "var(--muted-foreground)",
      Icon: FuelIcon,
      on: true,
      status: generatorFlowStatus(live.generator.kw),
      direction: live.generator.direction,
    })
  }
  return nodes
}

/** The inverter drawn at the hub (old FlowDiagram): an amber cabinet with a
 * display slot and a status light, centred on (cx, cy). Colours come from
 * the --hub-* theme tokens. */
function InverterIcon({
  cx,
  cy,
  size,
}: {
  cx: number
  cy: number
  size: number
}) {
  const s = size / 24
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}
      aria-hidden
    >
      <rect
        x={5.5}
        y={1.5}
        width={13}
        height={21}
        rx={2.5}
        fill="color-mix(in oklch, var(--hub-line) 28%, transparent)"
        stroke="var(--hub-line)"
        strokeWidth={1.2}
      />
      <path
        d="M8 2v20M16 2v20"
        stroke="var(--hub-line)"
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      <rect
        x={9}
        y={8}
        width={6}
        height={2.2}
        rx={1.1}
        fill="var(--hub-slot)"
      />
      <rect
        x={8.6}
        y={15.5}
        width={2.6}
        height={2}
        rx={0.4}
        fill="none"
        stroke="var(--hub-line)"
        strokeWidth={0.8}
      />
    </g>
  )
}

/** A curved connector from a node's edge to the centre node's edge. */
function connectorPath(from: Point, to: Point) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const sx = from.x + (dx / len) * (from.r + 4)
  const sy = from.y + (dy / len) * (from.r + 4)
  const ex = to.x - (dx / len) * (to.r + 6)
  const ey = to.y - (dy / len) * (to.r + 6)
  // Leave the node horizontally, then bend into the centre.
  const cx = sx + (ex - sx) * 0.6
  return `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ey}, ${ex} ${ey}`
}

function Diagram({
  live,
  layout,
}: {
  live: SolarLive
  layout: "wide" | "tall"
}) {
  const { viewBox, nodes: pos } = LAYOUTS[layout]
  const nodes = buildNodes(live)
  const centre = pos.production

  return (
    <svg
      viewBox={viewBox}
      className="h-auto w-full"
      role="img"
      aria-label="Live power flow between solar, battery, grid, generator and load"
    >
      <style>{`
        @keyframes wyre-solar-flow { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
        .wyre-solar-pulse { animation: wyre-solar-flow 2.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .wyre-solar-pulse { animation: none; stroke-dasharray: none; opacity: 0.5; } }
      `}</style>

      {nodes
        .filter((n) => n.key !== "production")
        .map((n) => {
          const flow: FlowAnimation = connectorFlow(
            n.direction ?? null,
            n.sourceOff
          )
          const p = pos[n.key]
          // IN = Production → node: draw the path from the centre outwards so
          // the pulses travel that way.
          const d =
            flow === "from-centre"
              ? connectorPath(centre, p)
              : connectorPath(p, centre)
          return (
            <g key={`link-${n.key}`}>
              <path
                d={d}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {flow !== "none" &&
                [0, 0.73, 1.46].map((delay) => (
                  <path
                    key={delay}
                    d={d}
                    pathLength={100}
                    fill="none"
                    stroke={n.color}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeDasharray="6 94"
                    className="wyre-solar-pulse"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
            </g>
          )
        })}

      {nodes.map((n) => {
        const p = pos[n.key]
        const ring = 2 * Math.PI * (p.r + 6)
        const iconSize = p.r * 0.9
        const below = p.y + p.r + (n.percent !== undefined ? 22 : 18)
        return (
          <g key={n.key}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              // The hub, as on the old dashboard: solid yellow, amber edge.
              stroke={n.key === "production" ? "var(--hub-line)" : n.color}
              strokeWidth={2}
              style={{
                fill:
                  n.key === "production"
                    ? "var(--hub-fill)"
                    : `color-mix(in oklch, ${n.color} 16%, var(--card))`,
              }}
            />
            {n.percent !== undefined && (
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r + 6}
                fill="none"
                stroke={n.color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${(ring * Math.max(0, Math.min(100, n.percent))) / 100} ${ring}`}
                transform={`rotate(-90 ${p.x} ${p.y})`}
                opacity={0.75}
              />
            )}
            {n.key === "production" ? (
              <InverterIcon cx={p.x} cy={p.y} size={p.r * 1.45} />
            ) : (
              <n.Icon
                x={p.x - iconSize / 2}
                y={p.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                color={n.color}
                strokeWidth={1.75}
                aria-hidden
              />
            )}
            {n.on !== undefined && (
              <g
                transform={`translate(${p.x + p.r * 0.45}, ${p.y - p.r - 12})`}
              >
                <rect
                  width={34}
                  height={17}
                  rx={8.5}
                  fill={n.on ? "var(--success)" : "var(--destructive)"}
                />
                <text
                  x={17}
                  y={12.5}
                  textAnchor="middle"
                  className="text-[10px] font-bold"
                  fill={n.on ? "var(--success-foreground)" : "white"}
                >
                  {n.on ? "ON" : "OFF"}
                </text>
              </g>
            )}
            {n.key === "production" ? (
              <>
                <text
                  x={p.x}
                  y={p.y - p.r - 26}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {n.label}
                </text>
                <text
                  x={p.x}
                  y={p.y - p.r - 10}
                  textAnchor="middle"
                  className="text-sm font-semibold"
                  fill="var(--hub-line)"
                >
                  {n.value}
                </text>
              </>
            ) : (
              <>
                <text
                  x={p.x}
                  y={below}
                  textAnchor="middle"
                  className="fill-foreground text-[13px] font-semibold"
                >
                  {n.label}
                  {n.percent !== undefined &&
                    ` · ${formatNumber(n.percent, 0)}%`}
                </text>
                <text
                  x={p.x}
                  y={below + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {n.value}
                  {n.status && ` · ${n.status}`}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Animated power-flow diagram (old FlowDiagram), fed by `solar/live`. */
export function PowerFlowCard({ live }: { live: UseQueryResult<SolarLive> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Power flow</CardTitle>
        <CardDescription>
          Live, between the panels, battery, grid, generator and the building
        </CardDescription>
        <CardAction>
          <InfoHint>
            Moving dots show which way power is flowing right now. Capacity
            shows how much of the installed panel capacity is producing; the
            battery ring shows its state of charge. The generator appears only
            while it is on. &ldquo;Current dashboard&rdquo; shows the same
            readings drawn the way dashboard.wyreng.com draws them today.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {live.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : live.isError || !live.data ? (
          <CardError onRetry={() => live.refetch()} />
        ) : (
          // "Current dashboard" is the old diagram, kept for design review
          // against the new one; drop the tabs once the design is signed off.
          <Tabs defaultValue="ours" className="gap-4">
            <TabsList aria-label="Diagram version">
              <TabsTrigger value="ours">Ours</TabsTrigger>
              <TabsTrigger value="current">Current dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="ours">
              <div className="mx-auto hidden max-w-5xl sm:block">
                <Diagram live={live.data} layout="wide" />
              </div>
              <div className="mx-auto max-w-sm sm:hidden">
                <Diagram live={live.data} layout="tall" />
              </div>
            </TabsContent>
            <TabsContent value="current">
              <LegacyPowerFlow live={live.data} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
