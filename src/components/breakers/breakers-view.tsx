"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import {
  PowerIcon,
  PowerOffIcon,
  RadioTowerIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import { CardError } from "@/components/shared/card-parts"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  getBreakers,
  toggleBreaker,
  type Breaker,
  type BreakerState,
} from "@/lib/api/breakers"
import { ApiError } from "@/lib/api/client"
import { formatDeviceName } from "@/lib/format"
import { isOperator } from "@/lib/gating"

const isOn = (b: Breaker) => String(b.switch_state).toUpperCase() === "ON"

export function BreakersView() {
  const claims = useClaims()
  return (
    <>
      <PageHeader
        title="Breakers"
        description="Remote control of the branch's ACB breakers. Switching here opens or closes real equipment."
      />
      {isOperator(claims) ? (
        <BreakersContent branchId={claims.branch_id} />
      ) : (
        <NotAllowed />
      )}
    </>
  )
}

function NotAllowed() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Not allowed</EmptyTitle>
        <EmptyDescription>
          Only operators can view and switch breakers.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          Go to dashboard
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function BreakersContent({ branchId }: { branchId: number }) {
  const { selectedDeviceIds } = useFilters()
  const queryClient = useQueryClient()
  const queryKey = ["breakers", branchId]
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getBreakers(branchId, signal),
  })
  const [confirm, setConfirm] = React.useState<{
    breaker: Breaker
    next: BreakerState
  } | null>(null)

  const toggle = useMutation({
    mutationFn: ({ breaker, next }: { breaker: Breaker; next: BreakerState }) =>
      toggleBreaker(branchId, breaker.device_id, next),
    onSuccess: (_, { breaker, next }) => {
      toast.success(`${formatDeviceName(breaker.name)} switched ${next}`, {
        description: "The state shown updates when the breaker reports back.",
      })
      return queryClient.invalidateQueries({ queryKey })
    },
    onError: (error, { breaker }) =>
      toast.error(`Couldn't switch ${formatDeviceName(breaker.name)}`, {
        description: error instanceof ApiError ? error.message : undefined,
      }),
  })

  const breakers = (query.data ?? []).filter(
    (b) => !selectedDeviceIds.length || selectedDeviceIds.includes(b.device_id)
  )
  const switching = toggle.isPending
    ? toggle.variables?.breaker.device_id
    : undefined

  const columns: ColumnDef<Breaker, unknown>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Breaker",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatDeviceName(row.original.name)}
        </span>
      ),
    },
    { id: "device", accessorKey: "device_id", header: "Meter ID" },
    {
      id: "provider",
      accessorFn: (b) => b.provider ?? "",
      header: "Provider",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "type",
      accessorFn: (b) => (b.is_load ? "Load" : "Source"),
      header: "Feeds",
    },
    {
      id: "active",
      accessorFn: (b) => (b.is_active ? 1 : 0),
      header: "Status",
      cell: ({ row }) =>
        row.original.is_active === false ? (
          <Badge variant="secondary">Inactive</Badge>
        ) : (
          <Badge variant="outline">Active</Badge>
        ),
    },
    {
      id: "state",
      accessorFn: (b) => (isOn(b) ? 1 : 0),
      header: "State",
      meta: { align: "right" },
      cell: ({ row }) => {
        const b = row.original
        const on = isOn(b)
        const busy = switching === b.device_id
        return (
          <span className="inline-flex items-center justify-end gap-3">
            <span
              className={
                on ? "font-medium text-foreground" : "text-muted-foreground"
              }
            >
              {on ? "On" : "Off"}
            </span>
            {busy ? (
              <Spinner />
            ) : (
              <Switch
                checked={on}
                aria-label={`Switch ${formatDeviceName(b.name)} ${on ? "off" : "on"}`}
                disabled={toggle.isPending}
                onCheckedChange={(checked) =>
                  setConfirm({ breaker: b, next: checked ? "ON" : "OFF" })
                }
              />
            )}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <Alert>
        <RadioTowerIcon />
        <AlertTitle>Remote control</AlertTitle>
        <AlertDescription>
          Each switch sends a command to the breaker on site. Turning a breaker
          off cuts power to everything it feeds. You&apos;ll be asked to confirm
          every change.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>ACB breakers</CardTitle>
          <CardDescription>
            {selectedDeviceIds.length
              ? "Breakers of the devices selected in the device filter"
              : "Every breaker on this branch"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isError ? (
            <CardError onRetry={() => query.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={breakers}
              isLoading={query.isPending}
              emptyText={
                selectedDeviceIds.length
                  ? "None of the selected devices has a remote breaker."
                  : "This branch has no remotely controlled breakers."
              }
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                confirm?.next === "OFF"
                  ? "bg-destructive/10 text-destructive"
                  : undefined
              }
            >
              {confirm?.next === "OFF" ? <PowerOffIcon /> : <PowerIcon />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              Switch {confirm ? formatDeviceName(confirm.breaker.name) : ""}{" "}
              {confirm?.next === "OFF" ? "off" : "on"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.next === "OFF"
                ? "This opens the breaker on site. Everything it feeds will lose power until it is switched back on."
                : "This closes the breaker on site and energises everything it feeds. Make sure it is safe to do so."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.breaker.is_active === false && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              This breaker is marked inactive, so it may not respond.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.next === "OFF" ? "destructive" : "default"}
              onClick={() => {
                if (confirm) toggle.mutate(confirm)
                setConfirm(null)
              }}
            >
              Switch {confirm?.next === "OFF" ? "off" : "on"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
