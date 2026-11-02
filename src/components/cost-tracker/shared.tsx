"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"

import { CardError, InfoHint } from "@/components/shared/card-parts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { monthsInPeriod } from "@/lib/cost-tracker/rules"
import { formatNaira, formatNumber } from "@/lib/format"
import type { Period } from "@/lib/period"

/** Links between cost-tracker pages keep the global period (?view=&date=). */
export function useHrefWithFilters() {
  const params = useSearchParams()
  return React.useCallback(
    (path: string) => {
      const query = params.toString()
      return query ? `${path}?${query}` : path
    },
    [params]
  )
}

export function LinkButton({
  href,
  children,
  variant = "outline",
  size = "default",
}: {
  href: string
  children: React.ReactNode
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
}) {
  const withFilters = useHrefWithFilters()
  return (
    <Button
      nativeButton={false}
      variant={variant}
      size={size}
      render={<Link href={withFilters(href)} />}
    >
      {children}
    </Button>
  )
}

/** "October 2026", or "January – October 2026" for a year. A day shows its month. */
export function costPeriodLabel(period: Period) {
  const months = monthsInPeriod(period)
  if (months.length === 1) return format(months[0], "MMMM yyyy")
  return `${format(months[0], "MMMM")} – ${format(months[months.length - 1], "MMMM yyyy")}`
}

/** Card with title, description, (i) hint and loading/error handling. */
export function SectionCard({
  title,
  description,
  hint,
  action,
  error,
  onRetry,
  children,
}: {
  title: string
  description?: React.ReactNode
  hint?: React.ReactNode
  action?: React.ReactNode
  error?: boolean
  onRetry?: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {(hint || action) && (
          <CardAction className="flex items-center gap-2">
            {action}
            {hint && <InfoHint>{hint}</InfoHint>}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="min-w-0">
        {error && onRetry ? <CardError onRetry={onRetry} /> : children}
      </CardContent>
    </Card>
  )
}

// Cell formatters: 0 shows as 0, never blank or NaN.
export const litres = (n: number) => formatNumber(n)
/** "-₦20,633.88" rather than "₦-20,633.88" for differences. */
export const naira = (n: number) =>
  n < 0 ? `-${formatNaira(-n)}` : formatNaira(n)
export const kwh = (n: number) => formatNumber(n)
export const percent = (n: number) => `${formatNumber(n, 1)}%`
