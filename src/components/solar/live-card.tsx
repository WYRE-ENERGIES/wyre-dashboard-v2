"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { format } from "date-fns"
import { MapPinIcon, SunIcon } from "lucide-react"

import type { SolarData } from "@/components/solar/use-solar-data"
import {
  CardError,
  InfoHint,
  Stat,
  statCardClass,
} from "@/components/shared/card-parts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { SolarLive } from "@/lib/api/solar-types"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Segmented ring (old CircleGauge, 30 segments) filled to `percent`. */
export function SegmentGauge({
  percent,
  size = 160,
  segments = 30,
}: {
  percent: number
  size?: number
  segments?: number
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const active = Math.round((clamped / 100) * segments)
  const inner = size * 0.34
  const outer = size * 0.45
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`PV output at ${formatNumber(clamped, 0)}% of installed capacity`}
      className="shrink-0"
    >
      <g transform={`translate(${size / 2},${size / 2})`}>
        {Array.from({ length: segments }, (_, i) => {
          const angle = (i / segments) * Math.PI * 2 - Math.PI / 2
          const on = i < active
          return (
            <line
              key={i}
              x1={inner * Math.cos(angle)}
              y1={inner * Math.sin(angle)}
              x2={outer * Math.cos(angle)}
              y2={outer * Math.sin(angle)}
              stroke={on ? "var(--primary)" : "var(--border)"}
              strokeWidth={on ? 6 : 4}
              strokeLinecap="round"
            />
          )
        })}
        <text
          y={-4}
          textAnchor="middle"
          className="fill-foreground font-heading text-2xl font-semibold"
        >
          {formatNumber(clamped, 0)}%
        </text>
        <text
          y={18}
          textAnchor="middle"
          className="fill-muted-foreground text-xs"
        >
          of capacity
        </text>
      </g>
    </svg>
  )
}

/** Left card: weather header, PV gauge and the live stats (07 §2.4). */
export function LiveCard({
  data,
  live,
  polling,
}: {
  data: SolarData
  live: UseQueryResult<SolarLive>
  polling: boolean
}) {
  const w = data.weather.data
  const weatherLine = [
    w?.condition,
    w?.temperatureC != null ? `${formatNumber(w.temperatureC, 0)}°C` : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const l = live.data
  const capacityKwh = l?.battery?.capacityKwh

  return (
    <Card className={cn(statCardClass, "h-full")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live PV output
          <Badge
            variant={polling ? "default" : "outline"}
            className="font-normal"
          >
            {polling ? "Live" : "Paused"}
          </Badge>
        </CardTitle>
        <CardDescription className="flex flex-col gap-0.5">
          {data.weather.isPending ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {w?.city ?? "Location unavailable"}
                  {weatherLine && ` — ${weatherLine}`}
                </span>
              </span>
              {w?.sunshine && (
                <span className="flex items-center gap-1.5">
                  <SunIcon
                    className="size-3.5 shrink-0 text-highlight"
                    aria-hidden
                  />
                  Sunshine {w.sunshine} (UTC+01)
                </span>
              )}
            </>
          )}
        </CardDescription>
        <CardAction>
          <InfoHint>
            Current readings from the inverter. They refresh every few minutes
            while you use the page, and pause after 15 minutes without activity
            or when the tab is hidden. They don&apos;t follow the selected
            period.
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {live.isPending ? (
          <div className="flex items-center gap-6">
            <Skeleton className="size-40 rounded-full" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : live.isError || !l ? (
          <CardError onRetry={() => live.refetch()} />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <SegmentGauge percent={l.pv.percent} />
            <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-1">
              <LiveStat
                label="PV production"
                value={formatNumber(l.pv.kw, 3)}
                unit="kW"
                dot="bg-chart-1"
              />
              <LiveStat
                label="Installed capacity"
                value={formatNumber(l.pv.capacityKwp, 1)}
                unit="kWp"
                dot="bg-muted-foreground/40"
              />
              {l.battery && (
                <LiveStat
                  label="Battery charge"
                  value={`${formatNumber(l.battery.percent, 0)}%`}
                  dot="bg-chart-2"
                />
              )}
              {capacityKwh != null && (
                <LiveStat
                  label="Battery capacity"
                  value={formatNumber(
                    capacityKwh,
                    Number.isInteger(capacityKwh) ? 0 : 1
                  )}
                  unit="kWh"
                  dot="bg-chart-3"
                />
              )}
            </dl>
          </div>
        )}
        {live.dataUpdatedAt > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Updated {format(live.dataUpdatedAt, "HH:mm")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function LiveStat({
  label,
  value,
  unit,
  dot,
}: {
  label: string
  value: string
  unit?: string
  dot: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)}
        aria-hidden
      />
      <div className="min-w-0">
        <dt className="truncate text-xs text-muted-foreground">{label}</dt>
        <dd>
          <Stat value={value} unit={unit} className="text-lg" />
        </dd>
      </div>
    </div>
  )
}
