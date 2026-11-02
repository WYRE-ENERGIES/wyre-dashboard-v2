"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { MailIcon } from "lucide-react"

import { CardError } from "@/components/shared/card-parts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getReportPreview } from "@/lib/api/report"
import type { ReportRequest } from "@/lib/api/report-types"
import {
  REPORT_TYPE_LABEL,
  reportRequestKey,
} from "@/lib/report/report-request"
import { stripDashboardAccessSection } from "@/lib/report/preview-html"

/**
 * The email exactly as `forward-report` sends it today: the server-rendered
 * HTML from `preview-report/`, in a sandboxed iframe (no scripts, no
 * same-origin access; links open in a new tab). The "Dashboard Access" promo
 * is stripped, as in the old app. Loaded only when the dialog opens.
 */
export function EmailVersionDialog({
  request,
  title,
}: {
  request: ReportRequest
  title: string
}) {
  const [open, setOpen] = React.useState(false)
  const label = `${REPORT_TYPE_LABEL[request.report_type]} report email`
  const query = useQuery({
    queryKey: ["report", "preview", reportRequestKey(request)],
    queryFn: ({ signal }) => getReportPreview(request, signal),
    select: (data) =>
      data?.html_email ? stripDashboardAccessSection(data.html_email) : "",
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <MailIcon />
        Email version
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {title} · what recipients receive by email today
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <Skeleton className="h-[65vh] w-full" />
        ) : query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : !query.data ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No email available for this period.
          </p>
        ) : (
          <iframe
            title={label}
            srcDoc={query.data}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-[65vh] w-full rounded-xl border bg-background"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
