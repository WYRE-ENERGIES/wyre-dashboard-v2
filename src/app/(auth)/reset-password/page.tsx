import type { Metadata } from "next"

import { RequestResetForm } from "./request-reset-form"

export const metadata: Metadata = { title: "Reset password" }

// Same path as the old app, so existing links keep working.
export default function ResetPasswordPage() {
  return <RequestResetForm />
}
