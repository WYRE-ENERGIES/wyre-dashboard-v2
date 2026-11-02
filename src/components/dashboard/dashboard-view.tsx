"use client"

import { ZapOffIcon } from "lucide-react"

import { EnergyChart } from "@/components/dashboard/energy-chart"
import { KpiCards, TodayYesterdayCard } from "@/components/dashboard/kpi-cards"
import { LoadOverviewCard } from "@/components/dashboard/load-overview-card"
import { SourceCards } from "@/components/dashboard/source-cards"
import { UsageHoursChart } from "@/components/dashboard/usage-hours-chart"
import { useDashboardData } from "@/components/dashboard/use-dashboard-data"
import { useFilters } from "@/components/filters-provider"
import { SolarView } from "@/components/solar/solar-view"
import { useClaims } from "@/components/session-provider"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getProductAccess, showsDashboardLoadOverview } from "@/lib/gating"
import { periodLabel } from "@/lib/period"

export function DashboardView() {
  const claims = useClaims()
  const { hasEms, hasSolar } = getProductAccess(claims)

  // Solar-only users get Solar Overview as their dashboard, like production.
  if (!hasEms && hasSolar) return <SolarView />

  if (!hasEms) {
    // Production shows a blank page for users with neither product.
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ZapOffIcon />
          </EmptyMedia>
          <EmptyTitle>No energy monitoring on this account</EmptyTitle>
          <EmptyDescription>
            Contact Wyre to add energy monitoring or solar to this branch.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <EmsDashboard showLoadOverview={showsDashboardLoadOverview(claims)} />
}

function EmsDashboard({ showLoadOverview }: { showLoadOverview: boolean }) {
  const data = useDashboardData()
  const { period } = useFilters()

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Energy overview for {periodLabel(period)}
        </p>
      </div>
      <KpiCards data={data} />
      <SourceCards data={data} />
      <EnergyChart data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <UsageHoursChart data={data} />
        <TodayYesterdayCard data={data} />
      </div>
      {showLoadOverview && <LoadOverviewCard data={data} />}
    </>
  )
}
