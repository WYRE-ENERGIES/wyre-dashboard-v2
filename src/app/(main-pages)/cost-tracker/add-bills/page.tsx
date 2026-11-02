import type { Metadata } from "next"

import { AddBillsView } from "@/components/cost-tracker/add-bills-view"

export const metadata: Metadata = { title: "Add Bills" }

export default function AddBillsPage() {
  return <AddBillsView />
}
