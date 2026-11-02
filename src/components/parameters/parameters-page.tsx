"use client"

import { ZapOffIcon } from "lucide-react"

import { ParametersNav } from "@/components/parameters/parameters-nav"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getProductAccess } from "@/lib/gating"

/**
 * Frame of every Parameters page: header, the shared sub-navigation, then the
 * page's cards. Parameters are an energy-monitoring (EMS) feature; production
 * shows the menu only when `!isSolarOnly && hasEms` (inventory 07).
 */
export function ParametersPage({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const claims = useClaims()
  const { hasEms } = getProductAccess(claims)

  // `contain: inline-size` stops wide tables (Time of Use logs) from
  // stretching the shell's <main>, which has no min-width: 0; the tables
  // then scroll inside their own container.
  return (
    <div className="flex min-w-0 flex-col gap-6 [contain:inline-size]">
      <PageHeader
        title={title}
        description={description}
        actions={hasEms ? actions : undefined}
      />
      <ParametersNav />
      {hasEms ? (
        children
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ZapOffIcon />
            </EmptyMedia>
            <EmptyTitle>No energy monitoring on this account</EmptyTitle>
            <EmptyDescription>
              Parameters come from Wyre energy meters. Contact Wyre to add
              energy monitoring to this branch.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
