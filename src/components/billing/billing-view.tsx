"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowRightIcon,
  FileDownIcon,
  InfoIcon,
  ReceiptIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  BillingKwhChart,
  BillingNairaChart,
} from "@/components/billing/billing-charts"
import { ScheduleEmailDialog } from "@/components/billing/schedule-email-dialog"
import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import {
  CardError,
  InfoHint,
  ValueSkeleton,
  statCardClass,
} from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { downloadBillPdf, getBilling } from "@/lib/api/billing"
import { getSideBar } from "@/lib/api/endpoints"
import {
  billingSeries,
  billSummary,
  currentBranches,
  type DeviceBill,
} from "@/lib/billing/metrics"
import { DEMO } from "@/lib/demo"
import { fileSlug } from "@/lib/export"
import { formatDeviceName, formatNaira, formatNumber } from "@/lib/format"
import { visibleNav } from "@/lib/gating"
import { periodLabel, serializePeriod } from "@/lib/period"

export function BillingView() {
  const claims = useClaims()
  const allowed = visibleNav(claims).has("billing")

  if (!allowed && !DEMO) {
    return (
      <>
        <PageHeader title="Billing" />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptIcon />
            </EmptyMedia>
            <EmptyTitle>Billing isn&apos;t set up for this account</EmptyTitle>
            <EmptyDescription>
              Billing is for accounts that resell energy to tenants: it turns
              each meter&apos;s consumption into a bill you can download or
              email. Contact Wyre if you&apos;d like to bill your tenants.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }
  return (
    <BillingContent
      userId={claims.id}
      branchId={claims.branch_id}
      demoPreview={!allowed}
    />
  )
}

function BillingContent({
  userId,
  branchId,
  demoPreview,
}: {
  userId: number
  branchId: number
  demoPreview: boolean
}) {
  const { period, selectedDeviceIds } = useFilters()
  const { view, date } = serializePeriod(period)

  // One query keyed by user + period: no refetch loop (the old page refetched
  // whenever its own result changed — 59 calls in 90 s live).
  const billing = useQuery({
    queryKey: ["billing", userId, view, date],
    queryFn: ({ signal }) => getBilling(userId, period, signal),
  })
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const sideBarBranch = sideBar.data?.authenticatedData.branches[0]
  const sideDevices = sideBarBranch?.devices ?? []
  const selectedNames = sideDevices
    .filter((d) => selectedDeviceIds.includes(d.device_id))
    .map((d) => d.name)
  // Bill downloads and emails take device ids; with nothing selected, every
  // device (old PrintButtons / ScheduleEmailModal).
  const billDevices = (
    selectedDeviceIds.length
      ? sideDevices.filter((d) => selectedDeviceIds.includes(d.device_id))
      : sideDevices
  ).map((d) => d.id)

  const branches = currentBranches(billing.data, branchId, sideBarBranch?.name)
  const summary = billSummary(branches, selectedDeviceIds, selectedNames)
  const chart = billingSeries(summary.devices, period)
  const branchName = branches.length === 1 ? branches[0].name : undefined

  const download = useMutation({
    mutationFn: () => downloadBillPdf(userId, period, billDevices),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${fileSlug("wyre-bill", branchName ?? "branch", periodLabel(period))}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Bill downloaded")
    },
    onError: () =>
      toast.error("Couldn't download the bill", {
        description: "Please try again in a moment.",
      }),
  })

  const state = {
    loading: billing.isPending,
    error: billing.isError,
    onRetry: () => billing.refetch(),
  }
  const t = summary.totals

  return (
    <>
      <PageHeader
        title="Billing"
        description={`Bills per device${branchName ? ` at ${branchName}` : ""} · ${periodLabel(period)}`}
        actions={
          <>
            <ScheduleEmailDialog
              userId={userId}
              period={period}
              selectedDevices={billDevices}
            />
            <Button
              size="sm"
              onClick={() => download.mutate()}
              disabled={download.isPending || !billDevices.length}
            >
              {download.isPending ? <Spinner /> : <FileDownIcon />}
              Download bill
            </Button>
          </>
        }
      />

      {demoPreview && (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Billing is a reseller feature. Demo mode shows it on every account
            so you can try it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <BillCard
          title="Present bill"
          hint="Consumption and amount billed for the selected period."
          kwh={t.presentKwh}
          naira={t.presentNaira}
          state={state}
        />
        <BillCard
          title="Previous bill"
          hint="Consumption and amount billed for the period before."
          kwh={t.previousKwh}
          naira={t.previousNaira}
          state={state}
        />
        <Card size="sm" className="bg-brand text-brand-foreground ring-0">
          <CardHeader>
            <CardDescription className="text-brand-foreground/80">
              Total payable
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.loading ? (
              <ValueSkeleton className="bg-brand-foreground/20" />
            ) : state.error ? (
              <span className="text-sm">—</span>
            ) : (
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {formatNaira(t.presentNaira)}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <DeviceBillsTable rows={summary.rows} totals={t} state={state} />

      <div className="grid gap-4 xl:grid-cols-2">
        <BillingKwhChart
          period={period}
          rows={chart.rows}
          series={chart.series}
          state={state}
        />
        <BillingNairaChart period={period} rows={chart.rows} state={state} />
      </div>
    </>
  )
}

function BillCard({
  title,
  hint,
  kwh,
  naira,
  state,
}: {
  title: string
  hint: string
  kwh: number
  naira: number
  state: { loading: boolean; error: boolean; onRetry: () => void }
}) {
  return (
    <Card size="sm" className={statCardClass}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardAction>
          <InfoHint>{hint}</InfoHint>
        </CardAction>
      </CardHeader>
      <CardContent>
        {state.loading ? (
          <ValueSkeleton />
        ) : state.error ? (
          <CardError onRetry={state.onRetry} />
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {formatNaira(naira)}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(kwh)} kWh
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeviceBillsTable({
  rows,
  totals,
  state,
}: {
  rows: DeviceBill[]
  totals: {
    presentKwh: number
    presentNaira: number
    previousKwh: number
    previousNaira: number
  }
  state: { loading: boolean; error: boolean; onRetry: () => void }
}) {
  const columns = React.useMemo<ColumnDef<DeviceBill, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Device",
        cell: ({ row }) => formatDeviceName(row.original.name),
      },
      {
        id: "previous",
        accessorKey: "previousNaira",
        header: "Previous bill",
        meta: { align: "right" },
        cell: ({ row }) => (
          <BillCell
            kwh={row.original.previousKwh}
            naira={row.original.previousNaira}
          />
        ),
      },
      {
        id: "present",
        accessorKey: "presentNaira",
        header: "Present bill",
        meta: { align: "right" },
        cell: ({ row }) => (
          <BillCell
            kwh={row.original.presentKwh}
            naira={row.original.presentNaira}
          />
        ),
      },
    ],
    []
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bills by device</CardTitle>
        <CardDescription>
          Consumption (kWh) and amount (₦) per device
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.error ? (
          <CardError onRetry={state.onRetry} />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={state.loading}
            pageSize={false}
            emptyText="No billed devices in the current selection."
            footer={{
              name: "Total",
              previous: (
                <BillCell
                  kwh={totals.previousKwh}
                  naira={totals.previousNaira}
                />
              ),
              present: (
                <BillCell kwh={totals.presentKwh} naira={totals.presentNaira} />
              ),
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function BillCell({ kwh, naira }: { kwh: number; naira: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{formatNumber(kwh)} kWh</span>
      <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
      <span>{formatNaira(naira)}</span>
    </span>
  )
}
