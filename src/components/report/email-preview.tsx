"use client"

import { useQuery } from "@tanstack/react-query"

import { CardError } from "@/components/shared/card-parts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getReportPreview } from "@/lib/api/report"
import type { ReportRequest } from "@/lib/api/report-types"
import {
  REPORT_TYPE_LABEL,
  reportRequestKey,
} from "@/lib/report/report-request"
import { stripDashboardAccessSection } from "@/lib/report/preview-html"

/**
 * Daily and periodic reports: the server-rendered email from
 * `preview-report/`, in a sandboxed iframe (no scripts, no same-origin
 * access; links open in a new tab). The "Dashboard Access" promo is
 * stripped, as in the old app.
 */
export function EmailPreview({
  request,
  title,
}: {
  request: ReportRequest
  title: string
}) {
  const query = useQuery({
    queryKey: ["report", "preview", reportRequestKey(request)],
    queryFn: ({ signal }) => getReportPreview(request, signal),
    select: (data) =>
      data?.html_email ? stripDashboardAccessSection(data.html_email) : "",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {REPORT_TYPE_LABEL[request.report_type]} report preview
        </CardTitle>
        <CardDescription>
          {title} · the email recipients receive
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-[70vh] w-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No preview available for this period.
          </p>
        ) : (
          <iframe
            title={`${REPORT_TYPE_LABEL[request.report_type]} report preview`}
            srcDoc={query.data}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-[70vh] w-full rounded-xl border bg-background"
          />
        )}
      </CardContent>
    </Card>
  )
}
