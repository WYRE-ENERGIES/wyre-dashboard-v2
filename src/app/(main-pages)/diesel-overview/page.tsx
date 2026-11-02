import type { Metadata } from "next"

import { DieselView } from "@/components/diesel/diesel-view"

export const metadata: Metadata = { title: "Diesel Overview" }

export default function DieselOverviewPage() {
  return <DieselView />
}
