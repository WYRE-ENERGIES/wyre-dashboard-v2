import type { Metadata } from "next"

import { AddDieselEntryView } from "@/components/cost-tracker/add-diesel-entry-view"

export const metadata: Metadata = { title: "Add Diesel Entry" }

export default function AddDieselEntryPage() {
  return <AddDieselEntryView />
}
