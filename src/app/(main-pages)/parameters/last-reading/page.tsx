import type { Metadata } from "next"

import { LastReadingView } from "@/components/parameters/last-reading-view"

export const metadata: Metadata = { title: "Last reading" }

export default function Page() {
  return <LastReadingView />
}
