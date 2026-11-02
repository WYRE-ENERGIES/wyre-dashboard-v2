import type { Metadata } from "next"

import { PowerDemandView } from "@/components/parameters/power-demand-view"

export const metadata: Metadata = { title: "Power demand" }

export default function Page() {
  return <PowerDemandView />
}
