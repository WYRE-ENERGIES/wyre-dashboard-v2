import { apiRequest } from "@/lib/api/client"
import type {
  ForwardReportBody,
  MonthlyReportResponse,
  PreviewReportResponse,
  ReportRequest,
} from "@/lib/api/report-types"

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()

/** GET generate-report/?branch_id&month&year — the in-app monthly report.
 * The old app called this with raw axios, a hard-coded host and no auth. */
export const getMonthlyReport = (
  branchId: number,
  month: number,
  year: number,
  signal?: AbortSignal
) =>
  apiRequest<MonthlyReportResponse>(
    `generate-report/?${query({ branch_id: branchId, month, year })}`,
    { signal }
  )

/** GET preview-report/?report_type&branch_id&(date | start_date,end_date |
 * month,year) → the HTML email exactly as `forward-report` sends it. */
export const getReportPreview = (
  request: ReportRequest,
  signal?: AbortSignal
) =>
  apiRequest<PreviewReportResponse>(`preview-report/?${query(request)}`, {
    signal,
  })

/** POST forward-report/ — emails the report to a recipient, with optional CC. */
export const sendReport = (
  request: ReportRequest,
  recipient: string,
  carbonCopy: string[] = []
) =>
  apiRequest<unknown>("forward-report/", {
    method: "POST",
    body: {
      ...request,
      recipient,
      carbon_copy: carbonCopy,
    } satisfies ForwardReportBody,
  })
