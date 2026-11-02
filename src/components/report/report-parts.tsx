"use client"

import { useQuery } from "@tanstack/react-query"
import { CircleAlertIcon, type LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WyreLogo } from "@/components/wyre-logo"
import { getSideBar } from "@/lib/api/endpoints"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** The selected branch's display name (from side_bar_data, as the switcher). */
export function useBranchName() {
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  return sideBar.data?.authenticatedData.branches[0]?.name ?? ""
}

/**
 * The report "paper", laid out like the old dashboard's report page: a grey
 * sheet with the Wyre logo, the title and the period centred on top, then
 * white section cards.
 */
export function ReportDocument({
  kind,
  branchName,
  period,
  children,
}: {
  /** "Monthly", "Daily" or "Periodic". */
  kind: string
  branchName: string
  period: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-3xl bg-muted p-4 sm:p-8 dark:bg-muted/40">
      <header className="flex flex-col items-center gap-2 py-4 text-center">
        <WyreLogo className="mb-4 h-8 text-brand" />
        <h2 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {kind} Energy Report for {branchName || "your branch"}
        </h2>
        <p className="font-heading text-xl font-semibold sm:text-2xl">
          {period}
        </p>
        <p className="text-sm text-muted-foreground italic">powered by Wyre</p>
      </header>
      {children}
    </article>
  )
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-3 font-heading text-lg font-semibold tracking-tight">
      {children}
    </h3>
  )
}

/** A report section: icon badge and title, with the explanation shown beside
 * it (not hidden in a tooltip), as on the old report page. */
export function ReportCard({
  title,
  icon: Icon,
  hint,
  description,
  action,
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  hint?: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("min-w-0 ring-0", className)}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {title}
              {action}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {hint && (
          <p className="flex max-w-xs gap-2 text-xs text-muted-foreground">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {hint}
          </p>
        )}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

/** "Total Energy Consumed:" | squiggle + big number, as on the old page. */
export function TotalEnergyCard({
  value,
  unit = "kWh",
  note,
}: {
  value: number
  unit?: string
  note?: React.ReactNode
}) {
  return (
    <Card className="ring-0 sm:flex-row sm:gap-0 sm:py-0">
      <div className="flex items-center justify-center px-6 sm:flex-1 sm:py-8">
        <p className="font-heading text-lg font-semibold">
          Total Energy Consumed:
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-1 px-6 sm:flex-1 sm:border-l sm:py-8">
        <p className="flex items-center gap-3">
          <svg
            viewBox="0 0 40 20"
            className="h-5 w-10 shrink-0 text-chart-1"
            aria-hidden
          >
            <path
              d="M2 16C8 2 14 4 20 12S32 18 38 6"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </svg>
          <span className="font-heading text-4xl font-bold tabular-nums">
            {formatNumber(value)}
          </span>
          <span className="text-muted-foreground">{unit}</span>
        </p>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
    </Card>
  )
}
