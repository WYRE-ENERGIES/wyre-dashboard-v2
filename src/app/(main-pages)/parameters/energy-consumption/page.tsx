import type { Metadata } from "next"

import { EnergyConsumptionView } from "@/components/parameters/energy-consumption-view"

export const metadata: Metadata = { title: "Energy consumption" }

export default function Page() {
  return <EnergyConsumptionView />
}
