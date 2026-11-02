"use client"

import * as React from "react"
import {
  addYears,
  format,
  isAfter,
  isSameMonth,
  setMonth,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isFuturePeriod,
  periodEnd,
  periodLabel,
  periodShortLabel,
  periodStart,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from "@/lib/period"
import { cn } from "@/lib/utils"

const KINDS: Array<{ kind: PeriodKind; label: string }> = [
  { kind: "day", label: "Day" },
  { kind: "month", label: "Month" },
  { kind: "year", label: "Year" },
]

/** Pick the anchor for a new period kind: today if the current period
 * contains it, otherwise the start of the current period. */
function convert(period: Period, kind: PeriodKind): Period {
  const now = new Date()
  const containsToday =
    !isAfter(periodStart(period), now) && !isAfter(now, periodEnd(period))
  return {
    kind,
    anchor: periodStart({
      kind,
      anchor: containsToday ? now : periodStart(period),
    }),
  }
}

export function PeriodPicker() {
  const { period, setPeriod } = useFilters()
  const [open, setOpen] = React.useState(false)
  const next = shiftPeriod(period, 1)

  const choose = (p: Period) => {
    setPeriod(p)
    setOpen(false)
  }

  const now = new Date()
  const shortcuts: Array<{ label: string; period: Period }> = [
    { label: "Today", period: { kind: "day", anchor: now } },
    { label: "Yesterday", period: { kind: "day", anchor: subDays(now, 1) } },
    {
      label: "This month",
      period: { kind: "month", anchor: startOfMonth(now) },
    },
    {
      label: "Last month",
      period: { kind: "month", anchor: startOfMonth(subMonths(now, 1)) },
    },
    { label: "This year", period: { kind: "year", anchor: startOfYear(now) } },
  ]

  return (
    <div className="flex w-full items-center gap-2 md:w-auto">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[period.kind]}
        onValueChange={(values: string[]) => {
          const kind = values[0] as PeriodKind | undefined
          if (kind && kind !== period.kind) setPeriod(convert(period, kind))
        }}
        aria-label="Period type"
      >
        {KINDS.map(({ kind, label }) => (
          <ToggleGroupItem
            key={kind}
            value={kind}
            className="h-7 px-2 text-xs md:h-8 md:px-3 md:text-sm"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 md:size-8"
          aria-label="Previous period"
          onClick={() => setPeriod(shiftPeriod(period, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 flex-1 justify-center px-2 font-normal md:min-w-44 md:flex-none md:justify-start md:px-3"
              >
                <CalendarIcon className="hidden md:block" />
                <span className="truncate md:hidden">
                  {periodShortLabel(period)}
                </span>
                <span className="hidden truncate md:inline">
                  {periodLabel(period)}
                </span>
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-0">
            <div className="flex flex-col sm:flex-row">
              <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
                {shortcuts.map((s) => (
                  <Button
                    key={s.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() =>
                      choose({
                        kind: s.period.kind,
                        anchor: periodStart(s.period),
                      })
                    }
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="p-1">
                {period.kind === "day" && (
                  <Calendar
                    mode="single"
                    selected={period.anchor}
                    defaultMonth={period.anchor}
                    onSelect={(date) =>
                      date && choose({ kind: "day", anchor: date })
                    }
                    disabled={{ after: now }}
                  />
                )}
                {period.kind === "month" && (
                  <MonthGrid period={period} onSelect={choose} />
                )}
                {period.kind === "year" && (
                  <YearGrid period={period} onSelect={choose} />
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 md:size-8"
          aria-label="Next period"
          disabled={isFuturePeriod(next)}
          onClick={() => setPeriod(next)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

function MonthGrid({
  period,
  onSelect,
}: {
  period: Period
  onSelect: (p: Period) => void
}) {
  const [year, setYear] = React.useState(period.anchor.getFullYear())
  const now = new Date()
  return (
    <div className="w-64 p-2">
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous year"
          onClick={() => setYear(year - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next year"
          disabled={year >= now.getFullYear()}
          onClick={() => setYear(year + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, month) => {
          const date = setMonth(new Date(year, 0, 1), month)
          const selected = isSameMonth(date, period.anchor)
          return (
            <Button
              key={month}
              variant={selected ? "default" : "ghost"}
              size="sm"
              disabled={isAfter(date, now)}
              onClick={() => onSelect({ kind: "month", anchor: date })}
            >
              {format(date, "MMM")}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function YearGrid({
  period,
  onSelect,
}: {
  period: Period
  onSelect: (p: Period) => void
}) {
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 11 + i)
  return (
    <div className="grid w-64 grid-cols-3 gap-1 p-2">
      {years.map((year) => (
        <Button
          key={year}
          variant={year === period.anchor.getFullYear() ? "default" : "ghost"}
          size="sm"
          className={cn(year === thisYear && "font-semibold")}
          onClick={() =>
            onSelect({
              kind: "year",
              anchor: startOfYear(
                addYears(new Date(thisYear, 0, 1), year - thisYear)
              ),
            })
          }
        >
          {year}
        </Button>
      ))}
      <Separator className="col-span-3 my-1" />
      <p className="col-span-3 px-1 text-xs text-muted-foreground">
        One year is the maximum per view.
      </p>
    </div>
  )
}
