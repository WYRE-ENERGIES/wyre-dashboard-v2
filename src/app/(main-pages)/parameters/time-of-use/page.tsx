import type { Metadata } from "next"

import { TimeOfUseView } from "@/components/parameters/time-of-use-view"

export const metadata: Metadata = { title: "Time of use" }

export default function Page() {
  return <TimeOfUseView />
}
