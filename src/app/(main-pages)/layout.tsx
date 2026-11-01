import { Suspense } from "react"

import { AppShell } from "@/components/app-shell"

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
