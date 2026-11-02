"use client"

import * as React from "react"
import { FuelIcon, PlugIcon, ReceiptIcon } from "lucide-react"

import { BaselineChart, CostChart } from "@/components/cost-tracker/charts"
import {
  DieselOverviewCard,
  UtilityOverviewCard,
} from "@/components/cost-tracker/overview-tables"
import {
  DieselPurchasesCard,
  PaymentsCard,
} from "@/components/cost-tracker/registers"
import { costPeriodLabel, LinkButton } from "@/components/cost-tracker/shared"
import { useCostTrackerQueries } from "@/components/cost-tracker/use-cost-tracker"
import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { overviewRowsInPeriod, rowsInPeriod } from "@/lib/cost-tracker/rules"
import { isOperator } from "@/lib/gating"

/**
 * Cost Tracker (old mainAppPages/CostTracker.js). Follows the global period:
 * a Year shows its months, a Month or Day shows that month (cost data is
 * monthly). The branch is the sidebar branch. The endpoints have no date
 * parameters, so rows are filtered to the period here.
 */
export function CostTrackerView() {
  const claims = useClaims()
  const { period } = useFilters()
  const q = useCostTrackerQueries()
  const operator = isOperator(claims)
  const reseller = claims.client_type === "RESELLER"
  const periodText = costPeriodLabel(period)

  const overview = q.branchOverview.data?.data
  const branchName =
    overview?.branch_name ?? q.baseline.data?.data?.branch_name ?? ""
  const registers = React.useMemo(
    () => ({
      diesel: rowsInPeriod(overview?.branch_data?.diesel, period),
      utility: rowsInPeriod(overview?.branch_data?.utility, period),
      ipp: rowsInPeriod(overview?.branch_data?.ipp, period),
    }),
    [overview, period]
  )
  const dieselRows = React.useMemo(
    () =>
      overviewRowsInPeriod(
        q.dieselOverview.data?.data?.diesel_overview,
        period
      ),
    [q.dieselOverview.data, period]
  )
  const utilityRows = React.useMemo(
    () =>
      overviewRowsInPeriod(
        q.utilityOverview.data?.data?.utility_overview,
        period
      ),
    [q.utilityOverview.data, period]
  )
  const ippRows = React.useMemo(
    () => overviewRowsInPeriod(q.ippOverview.data?.data?.ipp_overview, period),
    [q.ippOverview.data, period]
  )
  const registerState = {
    isLoading: q.branchOverview.isPending,
    isError: q.branchOverview.isError,
    onRetry: () => void q.branchOverview.refetch(),
    periodText,
  }

  return (
    <>
      <PageHeader
        title="Cost Tracker"
        description={`${reseller ? "Diesel, utility and IPP" : "Diesel and utility"} costs for ${periodText}${period.kind === "day" ? " (cost data is monthly, so a day shows its month)" : ""}`}
        actions={
          <>
            {operator && (
              <>
                <LinkButton href="/cost-tracker/add-bills" variant="default">
                  <ReceiptIcon />
                  Add bills
                </LinkButton>
                <LinkButton href="/cost-tracker/add-diesel-entry">
                  <FuelIcon />
                  Add diesel entry
                </LinkButton>
              </>
            )}
            <LinkButton href="/cost-tracker/add-equipment">
              <PlugIcon />
              Add equipment
            </LinkButton>
          </>
        }
      />

      <section aria-labelledby="cost-overview" className="flex flex-col gap-4">
        <h2 id="cost-overview" className="font-heading text-lg font-medium">
          Cost overview
        </h2>
        <DieselOverviewCard
          rows={dieselRows}
          isLoading={q.dieselOverview.isPending}
          isError={q.dieselOverview.isError}
          onRetry={() => void q.dieselOverview.refetch()}
          periodText={periodText}
        />
        <UtilityOverviewCard
          title="Utility overview"
          hint="Tracks and verifies utility payments: energy purchased against energy the meters recorded."
          rows={utilityRows}
          isLoading={q.utilityOverview.isPending}
          isError={q.utilityOverview.isError}
          onRetry={() => void q.utilityOverview.refetch()}
          periodText={periodText}
        />
        {reseller && (
          <UtilityOverviewCard
            title="IPP overview"
            hint="Tracks and verifies IPP payments: energy purchased against energy consumed."
            rows={ippRows}
            isLoading={q.ippOverview.isPending}
            isError={q.ippOverview.isError}
            onRetry={() => void q.ippOverview.refetch()}
            periodText={periodText}
          />
        )}
      </section>

      <section aria-labelledby="cost-registers" className="flex flex-col gap-4">
        <h2 id="cost-registers" className="font-heading text-lg font-medium">
          Bills
        </h2>
        <DieselPurchasesCard
          rows={registers.diesel}
          branchName={branchName}
          {...registerState}
        />
        <PaymentsCard
          source="utility"
          rows={registers.utility}
          branchName={branchName}
          {...registerState}
        />
        {reseller && (
          <PaymentsCard
            source="ipp"
            rows={registers.ipp}
            branchName={branchName}
            {...registerState}
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BaselineChart
          data={q.baseline.data}
          branchName={branchName}
          isLoading={q.baseline.isPending}
          isError={q.baseline.isError}
          onRetry={() => void q.baseline.refetch()}
          periodText={periodText}
        />
        <CostChart
          diesel={overview?.branch_data?.diesel ?? []}
          utility={overview?.branch_data?.utility ?? []}
          ipp={overview?.branch_data?.ipp ?? []}
          showIpp={reseller}
          {...registerState}
        />
      </div>
    </>
  )
}
