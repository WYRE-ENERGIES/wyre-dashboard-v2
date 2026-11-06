"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { WEEKDAYS } from "@/lib/alerts/form"
import { cn } from "@/lib/utils"

/** Mon–Sun chips. At least one day stays selected (production refuses to
 * deselect the last day). Values are day indexes, Mon=0 … Sun=6. */
export function WeekdayPicker({
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  value: number[]
  onChange: (days: number[]) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      spacing={1}
      aria-label={label}
      disabled={disabled}
      value={value.map(String)}
      onValueChange={(next) => {
        if (!next.length) return
        onChange(next.map(Number).sort((a, b) => a - b))
      }}
      className={cn("flex-wrap", className)}
    >
      {WEEKDAYS.map((day, index) => (
        <ToggleGroupItem
          key={day}
          value={String(index)}
          aria-label={day}
          className="min-w-12 rounded-full border-brand/30 font-semibold text-brand data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand/90"
        >
          {day}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
