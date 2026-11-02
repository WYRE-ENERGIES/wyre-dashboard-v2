import type { Metadata } from "next"

import { PersonalDataView } from "@/components/account/personal-data-view"

export const metadata: Metadata = { title: "Personal Data" }

export default function PersonalDataPage() {
  return <PersonalDataView />
}
