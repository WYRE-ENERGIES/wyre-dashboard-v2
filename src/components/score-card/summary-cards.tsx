"use client"

import { TrendingDownIcon, TrendingUpIcon, TreesIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import {
  RatingBadge,
  RingGauge,
  TONE_TEXT,
} from "@/components/score-card/ring-gauge"
import { useScoreCardQuery } from "@/components/score-card/use-score-card-data"
import { CardError, InfoHint } from "@/components/shared/card-parts"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"
import {
  baselineEnergy,
  carbonEmission,
  peakToAverage,
  scoreCardDevices,
  type Tone,
} from "@/lib/score-card/metrics"
import { cn } from "@/lib/utils"

// Tooltip texts from the old components/toolTips/Score_Card_Tooltip_Messages.js.
const HINTS = {
  baseline:
    "An algorithm forecasts energy consumption by benchmarking energy use, weather and number of days to set a baseline. The baseline is compared with actual consumption to score energy performance.",
  papr: "The gap between peak and average power in the facility. To optimise efficiency, close the gap between the two: aim for a score as close to 1 as possible.",
  carbon:
    "Carbon footprint of all sources. Diesel: 2.68 kg CO₂ per litre. Gas: 0.549 kg CO₂ per kWh. Grid: 0.439 kg CO₂ per kWh. A typical hardwood tree absorbs up to 48 lb of CO₂ a year. Performance is scored against the baseline.",
}

function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="size-36 rounded-full" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}

function Row({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-sm",
        className
      )}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  )
}

function Savings({
  value,
  unit,
  tone,
}: {
  value: number
  unit: string
  tone: Tone
}) {
  const Icon = tone === "good" ? TrendingUpIcon : TrendingDownIcon
  return (
    <span className={cn("inline-flex items-center gap-1", TONE_TEXT[tone])}>
      <Icon className="size-4" aria-hidden />
      {formatNumber(value)} {unit}
    </span>
  )
}

function ScoreCardShell({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <InfoHint>{hint}</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {children}
      </CardContent>
    </Card>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="flex min-h-36 flex-1 items-center justify-center text-center text-sm text-muted-foreground">
    {children}
  </p>
)

export function BaselineEnergyCard() {
  const { period, selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("baseline-energy")
  const baseline = query.data
    ? baselineEnergy(scoreCardDevices(query.data, selectedDeviceIds), period)
    : null

  return (
    <ScoreCardShell title="Baseline energy" hint={HINTS.baseline}>
      {query.isPending ? (
        <GaugeSkeleton />
      ) : query.isError ? (
        <CardError onRetry={() => query.refetch()} />
      ) : !baseline ? (
        <Empty>No baseline for the selected sources in this period.</Empty>
      ) : (
        <>
          <RingGauge
            className="self-center"
            percent={baseline.percentUsed}
            tone={
              baseline.percentUsed != null && baseline.percentUsed > 100
                ? "bad"
                : "default"
            }
            label={
              baseline.percentUsed == null
                ? "n/a"
                : `${formatNumber(baseline.percentUsed, 0)}%`
            }
            caption={baseline.percentUsed == null ? "no forecast" : "used"}
          />
          <dl className="flex flex-col gap-2">
            <Row label="Baseline forecast">
              {formatNumber(baseline.forecast)} {baseline.unit}
            </Row>
            <Row label={baseline.pace.elapsedLabel}>
              {formatNumber(baseline.used)} {baseline.unit}
            </Row>
            <Row label={baseline.pace.complete ? "Savings" : "Savings inbound"}>
              <Savings
                value={baseline.savings}
                unit={baseline.unit}
                tone={baseline.savingsTone}
              />
            </Row>
          </dl>
          {!baseline.pace.complete && (
            <p className="text-xs text-muted-foreground">
              Savings inbound projects today&apos;s pace to the end of the
              period.
            </p>
          )}
        </>
      )}
    </ScoreCardShell>
  )
}

export function PeakToAverageCard() {
  const { selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("peak-to-avg-power-ratio")
  const papr = query.data
    ? peakToAverage(scoreCardDevices(query.data, selectedDeviceIds))
    : null

  return (
    <ScoreCardShell title="Peak to average power ratio" hint={HINTS.papr}>
      {query.isPending ? (
        <GaugeSkeleton />
      ) : query.isError ? (
        <CardError onRetry={() => query.refetch()} />
      ) : !papr ? (
        <Empty>No demand data for the selected sources in this period.</Empty>
      ) : (
        <>
          <RingGauge
            className="self-center"
            percent={papr.ratio * 100}
            tone={papr.tone}
            label={formatNumber(papr.ratio, 2)}
            caption="avg ÷ peak"
          />
          <dl className="flex flex-col gap-2">
            <Row label="Average load">{formatNumber(papr.avg)} kVA</Row>
            <Row label="Peak load">{formatNumber(papr.peak)} kVA</Row>
          </dl>
          <RatingBadge tone={papr.tone}>{papr.message}</RatingBadge>
        </>
      )}
    </ScoreCardShell>
  )
}

export function CarbonEmissionCard() {
  const { period, selectedDeviceIds } = useFilters()
  const query = useScoreCardQuery("carbon-emissions")
  const carbon = query.data
    ? carbonEmission(scoreCardDevices(query.data, selectedDeviceIds), period)
    : null

  return (
    <ScoreCardShell title="Carbon emission" hint={HINTS.carbon}>
      {query.isPending ? (
        <GaugeSkeleton />
      ) : query.isError ? (
        <CardError onRetry={() => query.refetch()} />
      ) : !carbon ? (
        <Empty>No emission data for the selected sources in this period.</Empty>
      ) : (
        <>
          <RingGauge
            className="self-center"
            percent={carbon.percentUsed}
            tone={
              carbon.percentUsed != null && carbon.percentUsed > 100
                ? "bad"
                : "default"
            }
            label={
              carbon.percentUsed == null
                ? "n/a"
                : `${formatNumber(carbon.percentUsed, 0)}%`
            }
            caption={carbon.percentUsed == null ? "no estimate" : "of estimate"}
          />
          <dl className="flex flex-col gap-2">
            <Row label="Estimated">
              {formatNumber(carbon.estimated, 3)} tons
            </Row>
            <Row
              label={
                carbon.pace.complete
                  ? "Actual emission"
                  : `Actual · ${carbon.pace.elapsedLabel.toLowerCase()}`
              }
            >
              {formatNumber(carbon.actual, 3)} tons
            </Row>
            <Row label={carbon.pace.complete ? "Savings" : "Savings inbound"}>
              <Savings
                value={carbon.savings}
                unit="tons"
                tone={carbon.savingsTone}
              />
            </Row>
          </dl>
          <p className="flex items-center gap-2 text-sm">
            <TreesIcon
              className="size-4 shrink-0 text-primary dark:text-primary-foreground"
              aria-hidden
            />
            {carbon.trees != null
              ? `Equivalent to ${formatNumber(carbon.trees)} Acacia trees`
              : "On pace to exceed the estimate, so no trees' worth saved yet."}
          </p>
        </>
      )}
    </ScoreCardShell>
  )
}
