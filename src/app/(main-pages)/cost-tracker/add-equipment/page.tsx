import type { Metadata } from "next"

import { AddEquipmentView } from "@/components/cost-tracker/add-equipment-view"

export const metadata: Metadata = { title: "Add Equipment" }

export default function AddEquipmentPage() {
  return <AddEquipmentView />
}
