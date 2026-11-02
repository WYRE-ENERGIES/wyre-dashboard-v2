"use client"

import * as React from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { PlusIcon, XIcon } from "lucide-react"

import { Callout } from "@/components/alerts/fields"
import { WeekdayPicker } from "@/components/alerts/weekday-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ALL_DAYS,
  formatThreshold,
  formatTime12h,
  type AlertsFormValues,
} from "@/lib/alerts/form"
import type { SocOperator } from "@/lib/api/alerts-types"

/**
 * Battery state-of-charge alerts (production, 07 §3.1 rows 2–3): email and
 * push switches, scheduled status times with their own weekdays, and
 * "charge crosses" thresholds. Shown only when the GET returns
 * `battery_soc_config`.
 */
export function BatterySocSection({ solarOnly }: { solarOnly: boolean }) {
  const { control, setValue } = useFormContext<AlertsFormValues>()
  const soc = useWatch({ control, name: "soc" })
  const set = <K extends keyof AlertsFormValues["soc"]>(
    key: K,
    value: AlertsFormValues["soc"][K]
  ) => setValue(`soc.${key}`, value as never, { shouldDirty: true })

  return (
    <div className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0">
      <SwitchLine
        id="soc-email"
        title="Send battery SOC alerts by email"
        checked={soc.email_enabled}
        onChange={(checked) => set("email_enabled", checked)}
      />
      <SwitchLine
        id="soc-push"
        title="Also notify the mobile app (push)"
        checked={soc.push_enabled}
        onChange={(checked) => set("push_enabled", checked)}
        className="pl-4"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ScheduleTimes
          value={soc.schedule_times}
          onChange={(next) => set("schedule_times", next)}
        />
        <Thresholds
          value={soc.thresholds}
          onChange={(next) => set("thresholds", next)}
        />
      </div>
      {solarOnly && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm font-medium">
                Night battery over-usage
              </span>
              <Badge
                variant={soc.email_enabled ? "default" : "secondary"}
                className="shrink-0"
              >
                {soc.email_enabled ? "On" : "Off"} · follows SOC email
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              When battery SOC email is on, Wyre can alert you overnight
              (18:00–07:00 Lagos) if the load is higher than the battery can
              sustain until sunrise — at most once a night, by email and push.
            </p>
            <Callout>
              {soc.email_enabled
                ? "Night over-usage alerts are active while battery SOC email is on."
                : "Turn on battery SOC email above to enable night over-usage alerts."}
            </Callout>
          </div>
        </>
      )}
    </div>
  )
}

function SwitchLine({
  id,
  title,
  checked,
  onChange,
  className,
}: {
  id: string
  title: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${className ?? ""}`}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {title}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value)}
      />
    </div>
  )
}

type ScheduleTime = AlertsFormValues["soc"]["schedule_times"][number]

function ScheduleTimes({
  value,
  onChange,
}: {
  value: ScheduleTime[]
  onChange: (next: ScheduleTime[]) => void
}) {
  const [time, setTime] = React.useState("")
  const [days, setDays] = React.useState<number[]>(ALL_DAYS)
  const [error, setError] = React.useState("")

  // Rules from handleAddScheduleTime (AlertsAndAlarms.js:241-259), plus the
  // 15-minute step the old TimePicker enforced.
  const add = () => {
    if (!time) return setError("Select a time to add.")
    if (Number(time.slice(3, 5)) % 15 !== 0)
      return setError("Pick a time on the quarter hour (:00, :15, :30, :45).")
    if (value.some((entry) => entry.time === time))
      return setError("This time is already scheduled.")
    onChange(
      [...value, { time, days }].sort((a, b) => a.time.localeCompare(b.time))
    )
    setTime("")
    setDays(ALL_DAYS)
    setError("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Scheduled updates</span>
        <p className="text-xs text-muted-foreground">
          A status message at each time (Africa/Lagos), on the days you pick.
          15-minute steps.
        </p>
      </div>
      {value.length ? (
        <ul className="flex flex-col gap-3">
          {value.map((entry) => (
            <li key={entry.time} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="tabular-nums">
                  {formatTime12h(entry.time)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${formatTime12h(entry.time)}`}
                  onClick={() =>
                    onChange(value.filter((e) => e.time !== entry.time))
                  }
                >
                  <XIcon />
                </Button>
              </div>
              <WeekdayPicker
                label={`Weekdays for ${formatTime12h(entry.time)}`}
                value={entry.days}
                onChange={(next) =>
                  onChange(
                    value.map((e) =>
                      e.time === entry.time ? { ...e, days: next } : e
                    )
                  )
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No times scheduled yet.</p>
      )}
      <Separator />
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="time"
            step={900}
            aria-label="New scheduled time"
            className="w-32"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              setError("")
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <PlusIcon />
            Add time
          </Button>
        </div>
        <WeekdayPicker
          label="Weekdays for the new time"
          value={days}
          onChange={setDays}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
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

  // handleAddThreshold (AlertsAndAlarms.js:274-295).
  const add = () => {
    const text = percent.trim()
    if (!text) return setError("Enter a SOC percentage.")
    const n = Number(text)
    if (!Number.isFinite(n) || n < 0 || n > 100)
      return setError("Enter a percentage from 0 to 100.")
    if (value.some((t) => t.operator === operator && t.value === n)) {
      return setError("This threshold is already configured.")
    }
    onChange([...value, { operator, value: n }])
    setPercent("")
    setError("")
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">When battery charge crosses</span>
        <p className="text-xs text-muted-foreground">
          One alert when SOC reaches a level, e.g. drops to 30% or rises to 80%.
          It won&apos;t repeat until SOC recovers by about 3%.
        </p>
      </div>
      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((t, index) => (
            <li key={`${t.operator}-${t.value}`}>
              <Badge variant="outline" className="gap-1 pr-1 tabular-nums">
                {formatThreshold(t)}
                <button
                  type="button"
                  aria-label={`Remove ${formatThreshold(t)}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No thresholds yet.</p>
      )}
      <Separator />
      <div className="flex flex-col gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={1}
          aria-label="Direction"
          value={[operator]}
          onValueChange={(next) =>
            next[0] && setOperator(next[0] as SocOperator)
          }
        >
          <ToggleGroupItem
            value="lte"
            className="data-pressed:border-brand data-pressed:bg-brand/10"
          >
            Drops to or below (≤)
          </ToggleGroupItem>
          <ToggleGroupItem
            value="gte"
            className="data-pressed:border-brand data-pressed:bg-brand/10"
          >
            Rises to or above (≥)
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="30"
            aria-label="SOC threshold percentage"
            className="w-24 tabular-nums"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value)
              setError("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <PlusIcon />
            Add threshold
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
