import type { Metadata } from "next"

import { PasswordForm } from "@/components/account/password-form"

export const metadata: Metadata = { title: "Password" }

export default function PasswordPage() {
  return <PasswordForm />
}
