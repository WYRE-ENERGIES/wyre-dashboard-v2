"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  getBatteryPlot,
  getConsumptionPlot,
  getPvPlot,
  getSolarLive,
  getSolarWeather,
  getSolarYield,
} from "@/lib/api/solar"
import type { SolarDate } from "@/lib/api/solar-types"
import { serializePeriod } from "@/lib/period"
import {
  LIVE_IDLE_MS,
  livePollMs,
  mapLimit,
  mergeYields,
  periodBuckets,
  periodSolarDate,
  seriesRow,
} from "@/lib/solar/metrics"

/**
 * True while the tab is visible and the user has done something in the last
 * 15 minutes (production's rule, inventory 07 §2.2). Activity: mousedown,
 * keydown, scroll, touchstart, click, and mousemove throttled to 5 s.
 */
export function useUserActive(idleMs = LIVE_IDLE_MS) {
  const [visible, setVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible"
  )
  const [idle, setIdle] = useState(false)
  const last = useRef(0)

  useEffect(() => {
    last.current = Date.now()
    let lastMove = 0
    const mark = () => {
      last.current = Date.now()
      setIdle(false)
    }
    const onMove = () => {
      const now = Date.now()
      if (now - lastMove < 5000) return
      lastMove = now
      mark()
    }
    const onVisibility = () => {
      const isVisible = document.visibilityState === "visible"
      setVisible(isVisible)
      if (isVisible) mark()
    }
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ] as const
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }))
    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)
    const timer = window.setInterval(() => {
      if (Date.now() - last.current >= idleMs) setIdle(true)
    }, 30_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark))
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(timer)
    }
  }, [idleMs])

  return visible && !idle
}

/**
 * `solar/live`: fetched on mount, then polled silently every
 * `refresh_interval_seconds` (default 300 s). Polling stops while the tab is
 * hidden or the user is idle, and resumes with an immediate fetch.
 */
export function useSolarLive(branchId: number) {
  const active = useUserActive()
  const live = useQuery({
    queryKey: ["solar", "live", branchId],
    queryFn: ({ signal }) => getSolarLive(branchId, signal),
    staleTime: 0,
    refetchInterval: (query) =>
      active ? livePollMs(query.state.data?.refreshSeconds) : false,
    refetchIntervalInBackground: false,
  })

  const { refetch } = live
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) void refetch()
    wasActive.current = active
  }, [active, refetch])

  return { live, polling: active }
}

/**
 * Period-driven solar data. One query per endpoint:
 * - Day:   yield for that day + the three hourly plots.
 * - Month: yield for the month + per-day yields for the daily charts.
 * - Year:  per-month yields, used for both the summary and the monthly charts
 *          (there is no year filter on `solar/yield`).
 * Plus "all time" yield (production's default view) on demand.
 */
export function useSolarData({ allTime }: { allTime: boolean }) {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const queryClient = useQueryClient()
  const { view, date } = serializePeriod(period)
  const key = [branchId, view, date] as const
  const day =
    period.kind === "day"
      ? (periodSolarDate(period) as Required<SolarDate>)
      : null

  const weather = useQuery({
    queryKey: ["solar", "overview", branchId],
    queryFn: ({ signal }) => getSolarWeather(branchId, signal),
  })

  const seriesOptions = {
    queryKey: ["solar", "yield-buckets", ...key],
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const buckets = periodBuckets(period)
      const yields = await mapLimit(buckets, 4, (b) =>
        getSolarYield(
          branchId,
          { year: b.year, month: b.month, day: b.day },
          signal
        )
      )
      return buckets.map((b, i) => ({ key: b.key, yield: yields[i] }))
    },
  }
  const series = useQuery({ ...seriesOptions, enabled: period.kind !== "day" })

  const summary = useQuery({
    queryKey: ["solar", "yield", ...key],
    queryFn: async ({ signal }) =>
      period.kind === "year"
        ? // Reuses (and shares the in-flight request with) the monthly buckets.
          mergeYields(
            (await queryClient.ensureQueryData(seriesOptions)).map(
              (b) => b.yield
            )
          )
        : getSolarYield(branchId, periodSolarDate(period), signal),
    enabled: !allTime,
  })

  const allTimeYield = useQuery({
    queryKey: ["solar", "yield", branchId, "all-time"],
    queryFn: ({ signal }) => getSolarYield(branchId, undefined, signal),
    enabled: allTime,
  })

  const consumption = useQuery({
    queryKey: ["solar", "consumption-hourly-plot", ...key],
    queryFn: ({ signal }) => getConsumptionPlot(branchId, day!, signal),
    enabled: day !== null,
  })
  const pv = useQuery({
    queryKey: ["solar", "pv-production-hourly-plot", ...key],
    queryFn: ({ signal }) => getPvPlot(branchId, day!, signal),
    enabled: day !== null,
  })
  const battery = useQuery({
    queryKey: ["solar", "battery-backup-hourly-plot", ...key],
    queryFn: ({ signal }) => getBatteryPlot(branchId, day!, signal),
    enabled: day !== null,
  })

  const rows = (series.data ?? []).map((b) => seriesRow(b.key, b.yield))

  return {
    branchId,
    period,
    weather,
    summary: allTime ? allTimeYield : summary,
    series,
    rows,
    consumption,
    pv,
    battery,
  }
}

export type SolarData = ReturnType<typeof useSolarData>
