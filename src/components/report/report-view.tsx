"use client"

import { CalendarClockIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import { EmailPreview } from "@/components/report/email-preview"
import { MonthlyReport } from "@/components/report/monthly-report"
import { SendReportDialog } from "@/components/report/send-report-dialog"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReportType } from "@/lib/api/report-types"
import { isFuturePeriod, periodLabel } from "@/lib/period"
import {
  periodForReportType,
  REPORT_TYPE_BY_KIND,
  REPORT_TYPE_LABEL,
  reportRequest,
} from "@/lib/report/report-request"

const TYPES: ReportType[] = ["daily", "monthly", "periodic"]

/**
 * /report. The report type follows the global period (Day → Daily, Month →
 * Monthly, Year → Periodic for that year); the tabs are a shortcut that
 * switches the global period kind. Reports cover the whole branch, so the
 * device filter doesn't apply.
 */
export function ReportView() {
  const { branch_id: branchId } = useClaims()
  const { period, setPeriod } = useFilters()
  const type = REPORT_TYPE_BY_KIND[period.kind]
  const future = isFuturePeriod(period)
  const request = future ? null : reportRequest(period, branchId)
  const title = periodLabel(period)

  return (
    <>
      <PageHeader
        title="Report"
        description={`${REPORT_TYPE_LABEL[type]} report for ${title}. Reports cover the whole branch.`}
        actions={<SendReportDialog request={request} title={title} />}
      />
      <Tabs
        value={type}
        onValueChange={(value) =>
          setPeriod(periodForReportType(period, value as ReportType))
        }
      >
        <TabsList aria-label="Report type">
          {TYPES.map((t) => (
            <TabsTrigger key={t} value={t} className="px-3">
              {REPORT_TYPE_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!request ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>No report for a future period</EmptyTitle>
            <EmptyDescription>
              Pick today or an earlier day, month or year in the period picker.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : request.report_type === "monthly" ? (
        <MonthlyReport
          branchId={branchId}
          month={request.month}
          year={request.year}
        />
      ) : (
        <EmailPreview request={request} title={title} />
      )}
    </>
  )
}
