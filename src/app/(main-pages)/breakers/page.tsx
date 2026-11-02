import type { Metadata } from "next"

import { BreakersView } from "@/components/breakers/breakers-view"

export const metadata: Metadata = { title: "Breakers" }

export default function BreakersPage() {
  return <BreakersView />
}
