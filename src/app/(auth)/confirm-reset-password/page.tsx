import type { Metadata } from "next"
import { Suspense } from "react"

import { ConfirmResetForm } from "./confirm-reset-form"

export const metadata: Metadata = { title: "Set a new password" }

// Same path and `?token=` parameter as the old app, so links in reset emails
// keep working after cutover.
export default function ConfirmResetPasswordPage() {
  return (
    <Suspense>
      <ConfirmResetForm />
    </Suspense>
  )
}
