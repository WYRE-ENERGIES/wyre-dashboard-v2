"use client"

import * as React from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { ClockIcon, XIcon } from "lucide-react"

import { Callout, SwitchSaveContext } from "@/components/alerts/fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  formatThreshold,
  formatTime12h,
  MAX_SCHEDULE_TIMES,
  THRESHOLD_OPERATORS,
  type AlertsFormValues,
} from "@/lib/alerts/form"
import type { SocOperator } from "@/lib/api/alerts-types"

/**
 * Battery level email, as on the live page: one switch, then scheduled
 * status times and "charge crosses" thresholds. Shown only when the GET
 * returns `battery_soc_config`. Times use the operational days.
 */
export function BatterySocSection({ solarOnly }: { solarOnly: boolean }) {
  const { control, setValue } = useFormContext<AlertsFormValues>()
  const saveSwitch = React.useContext(SwitchSaveContext)
  const soc = useWatch({ control, name: "soc" })
  const set = <K extends keyof AlertsFormValues["soc"]>(
    key: K,
    value: AlertsFormValues["soc"][K]
  ) => setValue(`soc.${key}`, value as never, { shouldDirty: true })

  return (
    <>
      <div
        id="alert-battery"
        className="flex scroll-mt-24 flex-col gap-4 py-4 first:pt-0 last:pb-0"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="soc-email" className="text-sm font-medium">
              Battery level email
            </label>
            <p className="text-sm text-muted-foreground">
              Up to two times a day, plus one drop and one rise. Times use
              15-minute steps.
            </p>
          </div>
          <Switch
            id="soc-email"
            className="mt-0.5"
            checked={soc.email_enabled}
            onCheckedChange={(checked) => {
              set("email_enabled", checked)
              saveSwitch?.("soc.email_enabled", checked)
            }}
            aria-label="Send battery level alerts by email"
          />
        </div>
        {soc.email_enabled && (
          <div className="grid gap-3 lg:grid-cols-2">
            <ScheduleTimes
              value={soc.schedule_times}
              onChange={(next) => set("schedule_times", next)}
            />
            <Thresholds
              value={soc.thresholds}
              onChange={(next) => set("thresholds", next)}
            />
          </div>
        )}
      </div>
      {solarOnly && (
        <div
          id="alert-night-usage"
          className="flex scroll-mt-24 flex-col gap-2 py-4 first:pt-0 last:pb-0"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">
                Night battery over-usage
              </span>
              <p className="text-sm text-muted-foreground">
                Follows battery level email. When that email is on, Wyre can
                alert you overnight (18:00–07:00 Lagos) if load is higher than
                the battery can sustain until sunrise — at most once per night,
                by email and push.
              </p>
            </div>
            <Badge
              variant={soc.email_enabled ? "default" : "secondary"}
              className="shrink-0"
            >
              {soc.email_enabled
                ? "On with battery email"
                : "Follows battery email"}
            </Badge>
          </div>
          <Callout>
            {soc.email_enabled
              ? "Night over-usage alerts are active while battery level email is enabled."
              : "Turn on battery level email above to enable night over-usage alerts."}
          </Callout>
        </div>
      )}
    </>
  )
}

type ScheduleTime = AlertsFormValues["soc"]["schedule_times"][number]

const QUARTER_HOURS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4)
  const minutes = (index % 4) * 15
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  return { value, label: formatTime12h(value) }
})

function ScheduleTimes({
  value,
  onChange,
}: {
  value: ScheduleTime[]
  onChange: (next: ScheduleTime[]) => void
}) {
  const [time, setTime] = React.useState<string | null>(null)
  const [error, setError] = React.useState("")

  const add = () => {
    if (value.length >= MAX_SCHEDULE_TIMES) {
      return setError("You can add up to two times.")
    }
    if (!time) return setError("Select a time to add.")
    if (value.some((entry) => entry.time === time)) {
      return setError("This time is already scheduled.")
    }
    onChange([...value, { time }].sort((a, b) => a.time.localeCompare(b.time)))
    setTime(null)
    setError("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/15 bg-brand/5 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-brand">Scheduled updates</p>
        <p className="text-sm text-muted-foreground">
          Send a status at each time (Africa/Lagos), on your operational days.
          You can add up to two times. Granularity is 15 minutes.
        </p>
      </div>
      <div className="flex min-h-8 flex-wrap gap-2">
        {value.length ? (
          value.map((entry, index) => (
            <span
              // Older settings may repeat a time, so the index keeps keys unique.
              key={`${entry.time}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-background px-3 py-1.5 text-sm font-semibold text-brand"
            >
              {formatTime12h(entry.time)}
              <button
                type="button"
                aria-label={`Remove ${formatTime12h(entry.time)}`}
                className="rounded-full p-0.5 text-brand/80 hover:bg-brand/10 hover:text-brand"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">
            No times configured yet.
          </span>
        )}
      </div>
      {value.length < MAX_SCHEDULE_TIMES ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={QUARTER_HOURS}
            value={time}
            onValueChange={(next) => {
              setTime(next)
              setError("")
            }}
          >
            <SelectTrigger aria-label="Select time" className="min-w-36">
              <ClockIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_HOURS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={add}>
            Add time
          </Button>
        </div>
      ) : value.length > MAX_SCHEDULE_TIMES ? (
        <p className="text-sm text-muted-foreground">
          These were set up before the two-time limit and still apply. Remove{" "}
          {value.length - MAX_SCHEDULE_TIMES} to add a different time.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Two times is the maximum.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

type Threshold = AlertsFormValues["soc"]["thresholds"][number]

function Thresholds({
  value,
  onChange,
}: {
  value: Threshold[]
  onChange: (next: Threshold[]) => void
}) {
  const [operator, setOperator] = React.useState<SocOperator>("lte")
  const [percent, setPercent] = React.useState("")
  const [error, setError] = React.useState("")

  const available = THRESHOLD_OPERATORS.filter(
    (option) => !value.some((entry) => entry.operator === option.value)
  )
  const selected = available.some((option) => option.value === operator)
    ? operator
    : available[0]?.value

  const add = () => {
    const text = percent.trim()
    if (!text) return setError("Enter a battery level percentage.")
    const n = Number(text)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return setError("Enter a percentage from 0 to 100.")
    }
    if (!selected) return setError("One drop and one rise is the maximum.")
    // `selected` is always a direction not in use yet.
    onChange([...value, { operator: selected, value: n }])
    setPercent("")
    const remaining = THRESHOLD_OPERATORS.find(
      (option) => option.value !== selected
    )
    if (
      remaining &&
      !value.some((entry) => entry.operator === remaining.value)
    ) {
      setOperator(remaining.value)
    }
    setError("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/15 bg-brand/5 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-brand">
          When battery charge crosses
        </p>
        <p className="text-sm text-muted-foreground">
          Alert once when the battery reaches a level you set — one drop and one
          rise, for example drops to 30% or rises to 80%. It will not repeat
          until the battery level recovers by about 3%.
        </p>
      </div>
      <div className="flex min-h-8 flex-wrap gap-2">
        {value.length ? (
          value.map((entry, index) => (
            <span
              key={`${entry.operator}-${entry.value}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-background px-3 py-1.5 text-sm font-semibold text-brand tabular-nums"
            >
              {formatThreshold(entry)}
              <button
                type="button"
                aria-label={`Remove ${formatThreshold(entry)}`}
                className="rounded-full p-0.5 text-brand/80 hover:bg-brand/10 hover:text-brand"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">
            No thresholds configured yet.
          </span>
        )}
      </div>
      {available.length > 0 && selected ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={available}
            value={selected}
            onValueChange={(next) => {
              if (next) setOperator(next)
              setError("")
            }}
          >
            <SelectTrigger
              aria-label="Battery level direction"
              className="min-w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            inputMode="decimal"
            placeholder="30"
            aria-label="Battery level percentage"
            className="w-20 tabular-nums"
            value={percent}
            onChange={(event) => {
              setPercent(event.target.value)
              setError("")
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                add()
              }
            }}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button type="button" onClick={add}>
            Add threshold
          </Button>
        </div>
      ) : value.length > THRESHOLD_OPERATORS.length ? (
        <p className="text-sm text-muted-foreground">
          These were set up before the one-drop-one-rise limit and still apply.
          Remove the extras to add a different level.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          One drop and one rise is the maximum.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
