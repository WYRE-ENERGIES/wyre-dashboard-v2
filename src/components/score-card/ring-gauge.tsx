import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/score-card/metrics"

const TONE_STROKE: Record<Tone | "default", string> = {
  default: "stroke-primary",
  good: "stroke-primary",
  fair: "stroke-highlight",
  bad: "stroke-destructive",
}

/**
 * A ring filled to `percent` (0–100, clamped), with a label in the middle.
 * Replaces the old chart.js score-card doughnuts, which only ever showed
 * "used vs the rest".
 */
export function RingGauge({
  percent,
  tone = "default",
  label,
  caption,
  size = 140,
  className,
}: {
  percent: number | null
  tone?: Tone | "default"
  label: React.ReactNode
  caption?: React.ReactNode
  size?: number
  className?: string
}) {
  const r = 42
  const circumference = 2 * Math.PI * r
  const filled = Math.min(100, Math.max(0, percent ?? 0))
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        {filled > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(filled / 100) * circumference} ${circumference}`}
            className={cn(
              "transition-[stroke-dasharray] duration-500",
              TONE_STROKE[tone]
            )}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading text-xl font-semibold tabular-nums">
          {label}
        </span>
        {caption && (
          <span className="text-xs text-muted-foreground">{caption}</span>
        )}
      </div>
    </div>
  )
}

const TONE_BADGE: Record<Tone, string> = {
  good: "bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground",
  fair: "bg-highlight/30 text-highlight-foreground dark:bg-highlight/15 dark:text-highlight",
  bad: "bg-destructive/10 text-destructive dark:bg-destructive/20",
}

/** The coloured rating text the old cards showed (green / amber / red). */
export function RatingBadge({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_BADGE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-primary dark:text-primary-foreground",
  fair: "text-highlight-foreground dark:text-highlight",
  bad: "text-destructive",
}
