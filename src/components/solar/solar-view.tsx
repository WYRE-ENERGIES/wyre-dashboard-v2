"use client"

import { CloudOffIcon, SunIcon } from "lucide-react"
import { useState } from "react"

import { LiveCard } from "@/components/solar/live-card"
import { PowerFlowCard } from "@/components/solar/power-flow-card"
import {
  BatteryChart,
  ParametersChart,
  PvProductionChart,
} from "@/components/solar/solar-charts"
import { useSolarData, useSolarLive } from "@/components/solar/use-solar-data"
import { YieldCard } from "@/components/solar/yield-card"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getProductAccess } from "@/lib/gating"
import { periodLabel } from "@/lib/period"

export function SolarView() {
  const claims = useClaims()
  // Gated by has_solar (inventory 07 §1). Routes aren't guarded in the old
  // app, so a non-solar user can land here by URL: explain instead.
  if (!getProductAccess(claims).hasSolar) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SunIcon />
          </EmptyMedia>
          <EmptyTitle>No solar on this account</EmptyTitle>
          <EmptyDescription>
            Solar Overview shows panel output, battery and power flow for
            branches with a Wyre-monitored solar system. Contact Wyre if
            you&apos;d like to add solar to this branch.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <SolarOverview />
}

function SolarOverview() {
  const data = useSolarData()
  const { live, polling } = useSolarLive(data.branchId)

  return (
    <>
      <PageHeader
        title="Solar Overview"
        description={`Solar, battery and grid · ${periodLabel(data.period)}`}
      />
      <DataDelayDialog
        active={live.data?.overlay.active ?? false}
        message={live.data?.overlay.message ?? ""}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <LiveCard data={data} live={live} polling={polling} />
        <YieldCard data={data} />
      </div>
      <PowerFlowCard live={live} />
      <ParametersChart data={data} />
      <div className="grid gap-4 xl:grid-cols-2">
        <PvProductionChart data={data} />
        <BatteryChart data={data} />
      </div>
    </>
  )
}

/**
 * "Wyre Data Delay Notification" (07 §2.7): shown while `solar/live` reports
 * `overlay.is_overlay`. Dismissing hides it until the flag clears and comes
 * back on.
 */
function DataDelayDialog({
  active,
  message,
}: {
  active: boolean
  message: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) setDismissed(false)
  }

  return (
    <Dialog
      open={active && !dismissed}
      onOpenChange={(open: boolean) => !open && setDismissed(true)}
      disablePointerDismissal
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <CloudOffIcon
              className="size-5 text-muted-foreground"
              aria-hidden
            />
          </div>
          <DialogTitle>Wyre data delay</DialogTitle>
          <DialogDescription render={<div />} className="flex flex-col gap-2">
            {message.split(/\n\s*\n+/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
