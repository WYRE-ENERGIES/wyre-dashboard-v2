"use client"

import * as React from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { ShieldAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertRow,
  SwitchSaveContext,
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
  draftKey,
  formatAlertsError,
  makeAlertsSchema,
  switchValue,
  toFormValues,
  toPayload,
  withDrafts,
  withSavedPayload,
  withSwitch,
  type AlertsFormValues,
  type SwitchName,
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
            ? "Notifications for your solar system: energy usage, battery level, weather and capacity."
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
  // Bumped after a full save has been refetched, to remount the form with
  // fresh defaults. Switch saves only patch the cached response (so coming
  // back to the page shows them) and must not remount: that would drop drafts.
  const [version, setVersion] = React.useState(0)

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
  return (
    <AlertsForm
      key={`${branchId}:${version}`}
      branchId={branchId}
      solarOnly={solarOnly}
      response={query.data}
      onReloaded={() => setVersion((v) => v + 1)}
    />
  )
}

function AlertsForm({
  branchId,
  solarOnly,
  response,
  onReloaded,
}: {
  branchId: number
  solarOnly: boolean
  response: AlertsResponse
  onReloaded: () => void
}) {
  const queryClient = useQueryClient()
  // Values as loaded; the form remounts after a full save (see the key on
  // AlertsForm), so this is also "as last saved" for the draft fields.
  const [initial] = React.useState(() => toFormValues(response))
  const form = useForm<AlertsFormValues>({
    resolver: zodResolver(makeAlertsSchema({ solarOnly })),
    defaultValues: initial,
  })
  const hasBattery = response.battery_soc_config != null

  // Switch saves (live page, inventory 07 §9.1): each flip POSTs the
  // last-saved settings with only that switch changed, so unsaved drafts are
  // not sent. Saves run one at a time. A failed save reverts the switch,
  // unless it has been flipped again since.
  const savedRef = React.useRef(initial)
  // Latest response (switch saves patch it), read by the queued saves.
  const responseRef = React.useRef(response)
  React.useEffect(() => {
    responseRef.current = response
  }, [response])
  const queueRef = React.useRef<Promise<void>>(Promise.resolve())
  const flipsRef = React.useRef(new Map<SwitchName, number>())
  const [switchSaves, setSwitchSaves] = React.useState(0)
  const saveSwitch = React.useCallback(
    (name: SwitchName, checked: boolean) => {
      const flip = (flipsRef.current.get(name) ?? 0) + 1
      flipsRef.current.set(name, flip)
      setSwitchSaves((n) => n + 1)
      queueRef.current = queueRef.current.then(async () => {
        const next = withSwitch(savedRef.current, name, checked)
        const payload = toPayload(responseRef.current, next)
        try {
          await saveAlerts(branchId, payload)
          savedRef.current = next
          queryClient.setQueryData<AlertsResponse>(
            ["alerts", branchId],
            (cached) => cached && withSavedPayload(cached, payload)
          )
        } catch (error) {
          if (flipsRef.current.get(name) === flip) {
            form.setValue(name, switchValue(savedRef.current, name))
            toast.error("Couldn't save that alert", {
              description:
                error instanceof ApiError
                  ? formatAlertsError(error.body ?? error.message)
                  : undefined,
            })
          }
        } finally {
          setSwitchSaves((n) => n - 1)
        }
      })
    },
    [branchId, form, queryClient]
  )

  const save = useMutation({
    mutationFn: async (values: AlertsFormValues) => {
      // Let pending switch saves land first; this POST carries them too.
      await queueRef.current
      return saveAlerts(branchId, toPayload(responseRef.current, values))
    },
    onSuccess: async () => {
      toast.success("Alert settings saved")
      await queryClient.invalidateQueries({ queryKey: ["alerts", branchId] })
      onReloaded()
    },
    onError: (error) =>
      toast.error("Couldn't save alert settings", {
        description:
          error instanceof ApiError
            ? formatAlertsError(error.body ?? error.message)
            : undefined,
      }),
  })

  const watched = useWatch({ control: form.control }) as AlertsFormValues
  const busy = save.isPending
  // Switches never make the page dirty: only days, times, thresholds and
  // limits wait for "Save".
  const [savedDrafts] = React.useState(() => draftKey(initial))
  const hasDrafts = draftKey(watched) !== savedDrafts
  const summary = alertSummary({
    values: watched,
    hasBattery,
    solarOnly,
  })
  const enabledSummary = summary.filter((item) => item.on)

  return (
    <FormProvider {...form}>
      <SwitchSaveContext.Provider value={saveSwitch}>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          className="flex flex-col gap-6 pb-20"
        >
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
            <div className="grid items-stretch gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
              <Card className="h-44 lg:w-max">
                <CardContent className="flex h-full flex-col justify-between">
                  <p className="font-heading text-base font-medium">
                    Operational days
                  </p>
                  <Controller
                    control={form.control}
                    name="daily_energy_usage_days"
                    render={({ field }) => (
                      <WeekdayPicker
                        label="Operational days"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={busy}
                        className="lg:flex-nowrap"
                      />
                    )}
                  />
                </CardContent>
              </Card>
              <Card className="h-44 min-w-0">
                <CardContent className="flex h-full flex-col gap-3">
                  <p className="flex items-baseline gap-2" aria-live="polite">
                    <span className="font-heading text-3xl font-semibold tracking-tight text-brand">
                      {enabledSummary.length}
                    </span>
                    <span className="text-muted-foreground">
                      of {summary.length} on
                    </span>
                  </p>
                  {enabledSummary.length > 0 ? (
                    <div className="flex max-h-16 flex-wrap content-start gap-1.5 overflow-hidden">
                      {enabledSummary.map((item) => (
                        <button
                          key={item.rowId}
                          type="button"
                          className="rounded-full bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/15"
                          onClick={() =>
                            document
                              .getElementById(item.rowId)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              })
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nothing is turned on yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <SettingsSection
              title="Energy reports"
              description="Daily and weekly usage, sent on a fixed schedule."
            >
              <AlertRow
                rowId="alert-daily-energy"
                name="daily_energy_usage_alerts"
                title="Daily energy usage"
                description="Previous day’s report at 10:00 (Africa/Lagos), on your operational days."
              />
              <AlertRow
                rowId="alert-weekly-energy"
                name="weekly_energy_usage_alerts"
                title="Weekly energy usage"
                description="Sent every Monday at 10:00 (Africa/Lagos)."
              />
            </SettingsSection>

            {hasBattery && (
              <SettingsSection
                title="Battery"
                description="Status emails on a schedule, and a one-time alert when charge crosses a level you set."
              >
                <BatterySocSection solarOnly={solarOnly} />
              </SettingsSection>
            )}

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
                <AlertRow
                  rowId="alert-weather"
                  name="daily_unfavorable_weather_alerts"
                  title="Daily unfavourable weather alerts"
                  description={
                    solarOnly
                      ? "Sent at 06:00 Lagos when today's forecast is poor for solar, by email and push."
                      : undefined
                  }
                />

                <AlertRow
                  rowId="alert-capacity"
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
                      rowId="alert-power-factor"
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
                      rowId="alert-load-balance"
                      name="load_balance_alerts"
                      title="Load imbalance"
                      description="When the load across the three phases is unbalanced."
                    />
                    <AlertRow
                      rowId="alert-frequency"
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
                      rowId="alert-voltage"
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
                    rowId="alert-baseline"
                    name="baseline_alerts"
                    title="When the forecast baseline is reached"
                  />
                  <AlertRow
                    rowId="alert-energy-target"
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
                    rowId="alert-forecast-co2"
                    name="emitted_co2_alerts"
                    title="When the forecast CO₂ is reached"
                  />
                  <AlertRow
                    rowId="alert-co2-target"
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
                    rowId="alert-generator-hours"
                    name="operating_time_alerts"
                    title="When a generator runs outside operating hours"
                  />
                  <AlertRow
                    rowId="alert-load"
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
            <span
              className="mr-auto hidden px-2 text-sm text-muted-foreground sm:inline"
              aria-live="polite"
            >
              {hasDrafts
                ? "Unsaved changes"
                : switchSaves > 0
                  ? "Saving…"
                  : "Switches save as you flip them. Days, times and limits apply after you save."}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !hasDrafts}
              onClick={() => form.reset(withDrafts(form.getValues(), initial))}
            >
              Discard
            </Button>
            <Button type="submit" disabled={busy || !hasDrafts}>
              {busy && <Spinner />}
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SwitchSaveContext.Provider>
    </FormProvider>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col divide-y">{children}</CardContent>
      </Card>
    </section>
  )
}

function alertSummary({
  values,
  hasBattery,
  solarOnly,
}: {
  values: {
    daily_energy_usage_alerts?: boolean
    weekly_energy_usage_alerts?: boolean
    daily_unfavorable_weather_alerts?: boolean
    solar_capacity_utilization_alerts?: boolean
    power_factor_alerts?: boolean
    load_balance_alerts?: boolean
    frequency_alerts?: boolean
    voltage_alerts?: boolean
    baseline_alerts?: boolean
    energy_usage_alerts?: boolean
    emitted_co2_alerts?: boolean
    set_co2_alerts?: boolean
    operating_time_alerts?: boolean
    load_alerts?: boolean
    soc?: { email_enabled?: boolean }
  }
  hasBattery: boolean
  solarOnly: boolean
}) {
  const on = (value: boolean | undefined) => Boolean(value)
  const summary = [
    {
      rowId: "alert-daily-energy",
      label: "Daily energy",
      on: on(values.daily_energy_usage_alerts),
    },
    {
      rowId: "alert-weekly-energy",
      label: "Weekly energy",
      on: on(values.weekly_energy_usage_alerts),
    },
  ]
  if (hasBattery) {
    summary.push({
      rowId: "alert-battery",
      label: "Battery level",
      on: Boolean(values.soc?.email_enabled),
    })
  }
  summary.push(
    {
      rowId: "alert-weather",
      label: "Weather",
      on: on(values.daily_unfavorable_weather_alerts),
    },
    {
      rowId: "alert-capacity",
      label: "Solar capacity",
      on: on(values.solar_capacity_utilization_alerts),
    }
  )
  if (!solarOnly) {
    summary.push(
      {
        rowId: "alert-power-factor",
        label: "Power factor",
        on: on(values.power_factor_alerts),
      },
      {
        rowId: "alert-load-balance",
        label: "Load balance",
        on: on(values.load_balance_alerts),
      },
      {
        rowId: "alert-frequency",
        label: "Frequency",
        on: on(values.frequency_alerts),
      },
      {
        rowId: "alert-voltage",
        label: "Voltage",
        on: on(values.voltage_alerts),
      },
      {
        rowId: "alert-baseline",
        label: "Baseline",
        on: on(values.baseline_alerts),
      },
      {
        rowId: "alert-energy-target",
        label: "Energy target",
        on: on(values.energy_usage_alerts),
      },
      {
        rowId: "alert-forecast-co2",
        label: "Forecast CO₂",
        on: on(values.emitted_co2_alerts),
      },
      {
        rowId: "alert-co2-target",
        label: "CO₂ target",
        on: on(values.set_co2_alerts),
      },
      {
        rowId: "alert-generator-hours",
        label: "Generator hours",
        on: on(values.operating_time_alerts),
      },
      {
        rowId: "alert-load",
        label: "Load",
        on: on(values.load_alerts),
      }
    )
  }
  return summary
}
