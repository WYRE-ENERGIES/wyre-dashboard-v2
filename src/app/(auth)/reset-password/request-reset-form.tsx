"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, CircleAlertIcon, MailCheckIcon } from "lucide-react"

import { AuthHeading } from "@/components/auth/auth-heading"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { requestPasswordReset } from "@/lib/api/endpoints"

export function RequestResetForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email")).trim()
    setError(null)
    setPending(true)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch {
      setError("We couldn't send the reset email. Try again in a moment.")
    } finally {
      setPending(false)
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-highlight/25 text-highlight-foreground dark:text-highlight">
          <MailCheckIcon className="size-6" />
        </span>
        <AuthHeading
          title="Check your email"
          description={
            <>
              If an account uses <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve
              sent a link to reset its password. The link expires after a while, so use it soon.
            </>
          }
        />
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
          <ArrowLeftIcon />
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        description="Enter the email on your Wyre account and we'll send you a reset link."
      />
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending && <Spinner />}
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <Button variant="ghost" className="w-full" nativeButton={false} render={<Link href="/login" />}>
            <ArrowLeftIcon />
            Back to sign in
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}
