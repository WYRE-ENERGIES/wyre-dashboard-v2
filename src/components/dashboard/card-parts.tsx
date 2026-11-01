"use client"

import { InfoIcon, RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Stat cards (overview row, energy sources) get a mild secondary fill on top
 * of the outline in light mode, so they stand out from the white page. Dark
 * mode keeps the default card surface. */
export const statCardClass = "bg-secondary dark:bg-card"

/** The (i) hint the old dashboard showed on each card. */
export function InfoHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="About this card"
            className={cn("text-muted-foreground hover:text-foreground", className)}
          />
        }
      >
        <InfoIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{children}</TooltipContent>
    </Tooltip>
  )
}

export function CardError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-2 text-sm text-muted-foreground", className)}>
      <span>Couldn&apos;t load this data.</span>
      <Button variant="outline" size="xs" onClick={onRetry}>
        <RotateCwIcon />
        Retry
      </Button>
    </div>
  )
}

export function ValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-8 w-28", className)} />
}

/** A number with its unit, e.g. "619.2 kWh". */
export function Stat({
  value,
  unit,
  className,
}: {
  value: string
  unit?: string
  className?: string
}) {
  return (
    <span className={cn("font-heading text-2xl font-semibold tabular-nums", className)}>
      {value}
      {unit && <span className="ml-1 text-sm font-normal opacity-70">{unit}</span>}
    </span>
  )
}
