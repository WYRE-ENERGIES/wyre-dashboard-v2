"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LinkIcon,
  XIcon,
} from "lucide-react"

import { AuthHeading } from "@/components/auth/auth-heading"
import { PasswordInput } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { confirmPasswordReset, validateResetToken } from "@/lib/api/endpoints"
import { cn } from "@/lib/utils"

// The password rules shown on the old app's change-password page.
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /\d/.test(p) },
  { label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export function ConfirmResetForm() {
  const token = useSearchParams().get("token")?.trim() ?? ""
  const validation = useQuery({
    queryKey: ["reset-token", token],
    queryFn: () => validateResetToken(token),
    enabled: Boolean(token),
    retry: false,
  })

  if (token && validation.isPending) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        Checking your reset link…
      </div>
    )
  }

  if (!token || validation.isError || !validation.data?.valid) {
    const expired = validation.data?.reason === "expired"
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <LinkIcon className="size-6" />
        </span>
        <AuthHeading
          title={expired ? "This link has expired" : "This link isn't valid"}
          description={
            expired
              ? "Reset links can only be used once and expire after a while. Request a new one to continue."
              : "The reset link is missing or incorrect. Request a new one to continue."
          }
        />
        <Button
          className="w-full"
          size="lg"
          nativeButton={false}
          render={<Link href="/reset-password" />}
        >
          Request a new link
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  return <NewPasswordForm token={token} />
}

function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const allRulesPass = RULES.every((rule) => rule.test(password))
  const matches = confirm.length > 0 && confirm === password

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allRulesPass)
      return setError(
        "Your new password doesn't meet all the requirements yet."
      )
    if (!matches) return setError("The two passwords don't match.")
    setError(null)
    setPending(true)
    try {
      await confirmPasswordReset(token, password)
      setDone(true)
    } catch {
      setError(
        "We couldn't reset your password. The link may have expired — request a new one."
      )
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-highlight/25 text-highlight-foreground dark:text-highlight">
          <CircleCheckIcon className="size-6" />
        </span>
        <AuthHeading
          title="Password updated"
          description="You can now sign in with your new password."
        />
        <Button
          className="w-full"
          size="lg"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <>
      <AuthHeading
        title="Set a new password"
        description="Choose a strong password you don't use elsewhere."
      />
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            <ul
              className="mt-1 grid gap-1 text-xs"
              aria-label="Password requirements"
            >
              {RULES.map((rule) => {
                const ok = rule.test(password)
                return (
                  <li
                    key={rule.label}
                    className={cn(
                      "flex items-center gap-1.5",
                      ok ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {ok ? (
                      <CheckIcon className="size-3.5 text-primary dark:text-highlight" />
                    ) : (
                      <XIcon className="size-3.5" />
                    )}
                    {rule.label}
                  </li>
                )
              })}
            </ul>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">
              Confirm new password
            </FieldLabel>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={confirm.length > 0 && !matches}
              required
            />
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-destructive">
                The passwords don&apos;t match.
              </p>
            )}
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending && <Spinner />}
            {pending ? "Saving…" : "Reset password"}
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}
