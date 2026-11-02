"use client"

import { DownloadIcon, ZapOffIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import {
  CostAnalysisCard,
  OperationalEfficiencyCard,
} from "@/components/diesel/efficiency-cards"
import { FuelBreakupCard, FuelUsageCard } from "@/components/diesel/fuel-cards"
import {
  EnergyByGeneratorCard,
  GeneratorStatusCard,
} from "@/components/diesel/generator-cards"
import { DieselHeaderCards } from "@/components/diesel/header-cards"
import { useDieselData } from "@/components/diesel/use-diesel-data"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { downloadElementAsPdf } from "@/lib/diesel/pdf"
import { fileSlug } from "@/lib/export"
import { getProductAccess } from "@/lib/gating"
import { periodLabel } from "@/lib/period"

export function DieselView() {
  const claims = useClaims()
  // Diesel Overview is part of the EMS product (old AppHeader nav gating).
  if (!getProductAccess(claims).hasEms) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ZapOffIcon />
          </EmptyMedia>
          <EmptyTitle>Diesel overview isn&apos;t on this account</EmptyTitle>
          <EmptyDescription>
            Generator and diesel tracking come with Wyre energy monitoring.
            Contact Wyre to add it to this branch.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <DieselOverview />
}

function DieselOverview() {
  const data = useDieselData()
  const { client } = useClaims()
  const reportRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const label = periodLabel(data.period)

  const download = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      await downloadElementAsPdf(reportRef.current, {
        title: "Diesel overview",
        subtitle: client ? `${client} · ${label}` : label,
        filename: `${fileSlug("diesel-overview", label)}.pdf`,
      })
      toast.success("Report downloaded")
    } catch {
      toast.error("Couldn't create the PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div ref={reportRef} className="flex flex-col gap-4">
      {/* The PDF draws its own title, so the page header is left out of it. */}
      <div data-pdf-ignore>
        <PageHeader
          title="Diesel Overview"
          description={`Generators, fuel and diesel cost · ${label}`}
          actions={
            <Button variant="outline" onClick={download} disabled={downloading}>
              {downloading ? <Spinner /> : <DownloadIcon />}
              Download report
            </Button>
          }
        />
      </div>
      <DieselHeaderCards data={data} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EnergyByGeneratorCard data={data} />
        <GeneratorStatusCard data={data} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FuelBreakupCard data={data} />
        <FuelUsageCard data={data} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <OperationalEfficiencyCard data={data} />
        <CostAnalysisCard data={data} />
      </div>
    </div>
  )
}
