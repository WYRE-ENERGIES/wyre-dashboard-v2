import type { Metadata } from "next"

import { CostTrackerView } from "@/components/cost-tracker/cost-tracker-view"

export const metadata: Metadata = { title: "Cost Tracker" }

export default function CostTrackerPage() {
  return <CostTrackerView />
}
