"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertRow,
  Callout,
  ThresholdGroup,
  ThresholdInput,
} from "@/components/alerts/fields"
import { BatterySocSection } from "@/components/alerts/battery-soc-section"
import { WeekdayPicker } from "@/components/alerts/weekday-picker"
import { useClaims } from "@/components/session-provider"
import { CardError } from "@/components/shared/card-parts"
import { PageHeader } from "@/components/shared/page-header"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  formatAlertsError,
  makeAlertsSchema,
  toFormValues,
  toPayload,
  type AlertsFormValues,
} from "@/lib/alerts/form"
import { getAlerts, saveAlerts } from "@/lib/api/alerts"
import type { AlertsResponse } from "@/lib/api/alerts-types"
import { ApiError } from "@/lib/api/client"
import { getProductAccess, isOperator } from "@/lib/gating"

export function AlertsView() {
  const claims = useClaims()
  const { hasEms, hasSolar } = getProductAccess(claims)
  const solarOnly = hasSolar && !hasEms

  return (
    <>
      <PageHeader
        title="Alerts and Alarms"
        description={
          solarOnly
            ? "Notifications for your solar system: energy usage, battery state of charge, weather and capacity."
            : "Choose how Wyre notifies you about anomalies, solar performance and operational events."
        }
      />
      {isOperator(claims) ? (
        // Purple controls in light mode as well (see .brand-controls).
        <div className="brand-controls contents">
          <AlertsSettings branchId={claims.branch_id} solarOnly={solarOnly} />
        </div>
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
          Only operators can view and change alert settings for this branch.
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

function AlertsSettings({
  branchId,
  solarOnly,
}: {
  branchId: number
  solarOnly: boolean
}) {
  const query = useQuery({
    queryKey: ["alerts", branchId],
    queryFn: ({ signal }) => getAlerts(branchId, signal),
  })

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-96 w-full rounded-4xl" />
        <Skeleton className="h-64 w-full rounded-4xl" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent>
          <CardError onRetry={() => query.refetch()} />
        </CardContent>
      </Card>
    )
  }
  // Remount with fresh defaults whenever the saved settings change.
  return (
    <AlertsForm
      key={query.dataUpdatedAt}
      branchId={branchId}
      solarOnly={solarOnly}
      response={query.data}
    />
  )
}

function AlertsForm({
  branchId,
  solarOnly,
  response,
}: {
  branchId: number
  solarOnly: boolean
  response: AlertsResponse
}) {
  const queryClient = useQueryClient()
  const form = useForm<AlertsFormValues>({
    resolver: zodResolver(makeAlertsSchema({ solarOnly })),
    defaultValues: toFormValues(response),
  })
  const hasBattery = response.battery_soc_config != null

  const save = useMutation({
    mutationFn: (values: AlertsFormValues) =>
      saveAlerts(branchId, toPayload(response, values)),
    onSuccess: () => {
      toast.success("Alert settings saved")
      return queryClient.invalidateQueries({ queryKey: ["alerts", branchId] })
    },
    onError: (error) =>
      toast.error("Couldn't save alert settings", {
        description:
          error instanceof ApiError
            ? formatAlertsError(error.body ?? error.message)
            : undefined,
      }),
  })

  const dailyOn = useWatch({
    control: form.control,
    name: "daily_energy_usage_alerts",
  })
  const busy = save.isPending

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4 pb-20"
      >
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {solarOnly
                  ? "Solar system alerts"
                  : "Standard alerts on anomalies"}
              </CardTitle>
              <CardDescription>
                Turn each alert on or off and set its threshold.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              <div className="flex flex-col gap-3 py-4 first:pt-0">
                <span className="text-sm font-medium">
                  Energy usage reports
                </span>
                <Callout>
                  Sent at fixed times: daily at 10:00 and weekly on Monday at
                  10:00 (Africa/Lagos). The daily report covers the previous
                  day.
                </Callout>
                <AlertRow
                  name="daily_energy_usage_alerts"
                  title="Daily energy usage report"
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground">
                      Days that get the 10:00 daily report — untick days you
                      don&apos;t want, e.g. weekends.
                    </span>
                    <Controller
                      control={form.control}
                      name="daily_energy_usage_days"
                      render={({ field }) => (
                        <WeekdayPicker
                          label="Weekdays for the daily energy usage report"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={busy || !dailyOn}
                        />
                      )}
                    />
                  </div>
                </AlertRow>
                <AlertRow
                  name="weekly_energy_usage_alerts"
                  title="Weekly energy usage report"
                />
              </div>

              {hasBattery && <BatterySocSection solarOnly={solarOnly} />}

              <AlertRow
                name="daily_unfavorable_weather_alerts"
                title="Daily unfavourable weather alerts"
                description={
                  solarOnly
                    ? "Sent at 06:00 Lagos when today's forecast is poor for solar, by email and push."
                    : undefined
                }
              />

              <AlertRow
                name="solar_capacity_utilization_alerts"
                title="Solar capacity utilisation"
                description={
                  solarOnly
                    ? "Any time of day. At most one email or push an hour while utilisation stays above the threshold."
                    : "When solar output exceeds this share of installed capacity."
                }
              >
                <ThresholdInput
                  name="solar_capacity_utilization_threshold_pct"
                  label="Threshold (0–90, of installed capacity)"
                  unit="%"
                  placeholder="90"
                />
              </AlertRow>

              {solarOnly ? (
                <>
                  <AlertRow
                    title="Daily solar generation recap (app)"
                    badge="Always on"
                    description="Every site that generated solar today gets a push and in-app message at 19:00 Lagos. Nothing to set here."
                  />
                  <AlertRow
                    title="Solar panel soiling"
                    badge="Weekly email"
                    description="If last week's yield looks low for the weather, the Monday weekly report says so. There's no separate push."
                  />
                </>
              ) : (
                <>
                  <AlertRow
                    name="power_factor_alerts"
                    title="Power factor"
                    description="When the power factor goes above the high limit or below the low limit."
                  >
                    <ThresholdGroup>
                      <ThresholdInput
                        name="max_power_factor"
                        label="High power factor"
                        placeholder="0.98"
                      />
                      <ThresholdInput
                        name="min_power_factor"
                        label="Low power factor"
                        placeholder="0.85"
                      />
                    </ThresholdGroup>
                  </AlertRow>
                  <AlertRow
                    name="load_balance_alerts"
                    title="Load imbalance"
                    description="When the load across the three phases is unbalanced."
                  />
                  <AlertRow
                    name="frequency_alerts"
                    title="Frequency variance"
                    description="When the frequency moves away from nominal by more than this amount."
                  >
                    <ThresholdInput
                      name="frequency_precision"
                      label="Variance (±)"
                      unit="Hz"
                      placeholder="0.5"
                    />
                  </AlertRow>
                  <AlertRow
                    name="voltage_alerts"
                    title="Voltage"
                    description="When the voltage goes above the high limit or below the low limit."
                  >
                    <ThresholdGroup>
                      <ThresholdInput
                        name="max_voltage"
                        label="High voltage"
                        unit="volts"
                        placeholder="250"
                      />
                      <ThresholdInput
                        name="min_voltage"
                        label="Low voltage"
                        unit="volts"
                        placeholder="190"
                      />
                    </ThresholdGroup>
                  </AlertRow>
                </>
              )}
            </CardContent>
          </Card>

          {!solarOnly && (
            <Card>
              <CardHeader>
                <CardTitle>Customised alerts on selected events</CardTitle>
                <CardDescription>
                  Targets and events you want to hear about.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                <AlertRow
                  name="baseline_alerts"
                  title="When the forecast baseline is reached"
                />
                <AlertRow
                  name="energy_usage_alerts"
                  title="When the energy target is reached"
                >
                  <ThresholdInput
                    name="energy_usage_max"
                    label="Energy target"
                    unit="kWh"
                  />
                </AlertRow>
                <AlertRow
                  name="emitted_co2_alerts"
                  title="When the forecast CO₂ is reached"
                />
                <AlertRow
                  name="set_co2_alerts"
                  title="When the CO₂ target is reached"
                >
                  <ThresholdInput
                    name="set_co2_value"
                    label="CO₂ target"
                    unit="tons"
                  />
                </AlertRow>
                <AlertRow
                  name="operating_time_alerts"
                  title="When a generator runs outside operating hours"
                />
                <AlertRow
                  name="load_alerts"
                  title="When the load exceeds a limit"
                >
                  <ThresholdInput
                    name="load_threshold_value"
                    label="Load limit"
                    unit="kW"
                  />
                </AlertRow>
              </CardContent>
            </Card>
          )}
        </fieldset>

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 self-stretch rounded-4xl border bg-background/95 p-2 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80 sm:self-end">
          <span className="mr-auto hidden px-2 text-sm text-muted-foreground sm:inline">
            {form.formState.isDirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !form.formState.isDirty}
            onClick={() => form.reset()}
          >
            Discard
          </Button>
          <Button type="submit" disabled={busy || !form.formState.isDirty}>
            {busy && <Spinner />}
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
