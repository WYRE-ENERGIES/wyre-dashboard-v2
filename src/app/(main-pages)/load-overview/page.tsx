import type { Metadata } from "next"

import { LoadOverviewView } from "@/components/load-overview/load-overview-view"

export const metadata: Metadata = { title: "Load Overview" }

export default function LoadOverviewPage() {
  return <LoadOverviewView />
}
