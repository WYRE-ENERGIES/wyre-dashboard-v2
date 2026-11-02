import type { Metadata } from "next"

import { SolarView } from "@/components/solar/solar-view"

export const metadata: Metadata = { title: "Solar Overview" }

export default function SolarOverviewPage() {
  return <SolarView />
}
