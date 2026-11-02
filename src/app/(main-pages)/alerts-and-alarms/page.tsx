import type { Metadata } from "next"

import { AlertsView } from "@/components/alerts/alerts-view"

export const metadata: Metadata = { title: "Alerts and Alarms" }

export default function AlertsAndAlarmsPage() {
  return <AlertsView />
}
