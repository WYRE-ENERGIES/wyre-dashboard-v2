"use client"

import { CalendarClockIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import {
  FuelEfficiencyCard,
  GeneratorSizeCard,
} from "@/components/score-card/generator-cards"
import { OperatingTimeCard } from "@/components/score-card/operating-time-card"
import {
  BaselineEnergyCard,
  CarbonEmissionCard,
  PeakToAverageCard,
} from "@/components/score-card/summary-cards"
import { PageHeader } from "@/components/shared/page-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { isFuturePeriod, periodLabel } from "@/lib/period"

export function ScoreCardView() {
  const { period } = useFilters()

  return (
    <>
      <PageHeader
        title="Score Card"
        description={`Efficiency scores for ${periodLabel(period)}`}
      />
      {isFuturePeriod(period) ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>This period hasn&apos;t started yet</EmptyTitle>
            <EmptyDescription>
              Pick today or an earlier period to see its scores.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BaselineEnergyCard />
            <PeakToAverageCard />
            <CarbonEmissionCard />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <GeneratorSizeCard />
            <FuelEfficiencyCard />
          </div>
          <OperatingTimeCard />
        </>
      )}
    </>
  )
}
