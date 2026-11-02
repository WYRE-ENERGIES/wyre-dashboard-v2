"use client"

import { TriangleAlertIcon } from "lucide-react"

import {
  BRANCH_WIDE_HINT,
  MONTH_ONLY_HINT,
  scopeText,
} from "@/components/diesel/parts"
import type { DieselData } from "@/components/diesel/use-diesel-data"
import {
  CardError,
  InfoHint,
  Stat,
  ValueSkeleton,
} from "@/components/shared/card-parts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DEMAND_ISSUE_TEXT,
  demandIssue,
  specificFuelConsumption,
} from "@/lib/diesel/metrics"
import { formatNaira, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Old OperationalEfficiencyCard.js. */
export function OperationalEfficiencyCard({ data }: { data: DieselData }) {
  const query = data.metrics
  const m = query.data
  const issue = m ? demandIssue(m.demand) : null
  const isYear = data.period.kind === "year"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational efficiency</CardTitle>
        <CardDescription>{scopeText(data.period, true)}</CardDescription>
        <CardAction>
          <InfoHint>
            How well the generators turn diesel into energy, and the power they
            were asked to supply.{" "}
            {data.period.kind === "day" && MONTH_ONLY_HINT}
            {isYear &&
              " For a year, demand max and min are the extremes across months; the other figures are monthly averages."}{" "}
            {BRANCH_WIDE_HINT}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ValueSkeleton className="h-40 w-full" />
        ) : query.isError || !m ? (
          <CardError onRetry={() => query.refetch()} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Metric label="Fuel efficiency">
              <Stat value={formatNumber(m.fuelEfficiency)} unit="kWh/L" />
            </Metric>
            <Metric label="Specific fuel consumption">
              <Stat
                value={formatNumber(specificFuelConsumption(m), 3)}
                unit="L/kWh"
              />
            </Metric>
            <Metric
              label={
                <span className="flex items-center gap-1.5">
                  Power demand
                  {issue && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Data check"
                            className="text-destructive"
                          />
                        }
                      >
                        <TriangleAlertIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">
                        {DEMAND_ISSUE_TEXT[issue]} These are the figures as
                        received from the server, shown unchanged; they look
                        inconsistent and need checking on Wyre&apos;s side.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              }
              className="sm:col-span-2"
            >
              <dl className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["Max", m.demand.max],
                    ["Avg", m.demand.avg],
                    ["Min", m.demand.min],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="flex flex-col">
                      <Stat
                        value={formatNumber(value, 1)}
                        className={cn(
                          "truncate text-xl",
                          // Highlight the value that breaks min ≤ avg ≤ max.
                          (issue === "min-above-max"
                            ? label !== "Avg"
                            : issue && label === "Avg") && "text-destructive"
                        )}
                      />
                      <span className="text-xs text-muted-foreground">kVA</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Metric>
            <Metric
              label="Generator efficiency score"
              className="sm:col-span-2"
            >
              <div className="flex items-center gap-3">
                <Stat value={`${formatNumber(m.efficiencyScore, 1)}%`} />
                <Progress
                  value={Math.max(0, Math.min(100, m.efficiencyScore))}
                  aria-label="Generator efficiency score"
                  className="flex-1"
                />
              </div>
            </Metric>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Old CostAnalysisCard.js. */
export function CostAnalysisCard({ data }: { data: DieselData }) {
  const query = data.cost
  const c = query.data
  const isYear = data.period.kind === "year"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost analysis</CardTitle>
        <CardDescription>{scopeText(data.period, true)}</CardDescription>
        <CardAction>
          <InfoHint>
            Diesel spend for the period, what a generator kWh cost, and the
            yearly cost at the current rate.{" "}
            {data.period.kind === "day" && MONTH_ONLY_HINT}
            {isYear &&
              " For a year, cost per kWh is the average across months and the forecast is the latest month's."}{" "}
            {BRANCH_WIDE_HINT}
          </InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <ValueSkeleton className="h-32 w-full" />
        ) : query.isError || !c ? (
          <CardError onRetry={() => query.refetch()} />
        ) : (
          <dl className="flex flex-col divide-y">
            <CostRow label="Total cost" value={formatNaira(c.totalCost)} />
            <CostRow
              label="Diesel cost per kWh"
              value={formatNaira(c.costPerKwh)}
            />
            <CostRow
              label="Annual cost forecast"
              value={formatNaira(c.annualForecast)}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl font-semibold text-primary tabular-nums">
        {value}
      </dd>
    </div>
  )
}
