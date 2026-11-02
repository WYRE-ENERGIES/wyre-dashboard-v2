import type { Metadata } from "next"

import { PowerQualityView } from "@/components/parameters/power-quality-view"

export const metadata: Metadata = { title: "Power quality" }

export default function Page() {
  return <PowerQualityView />
}
