"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleAlertIcon } from "lucide-react"

import { AuthHeading } from "@/components/auth/auth-heading"
import { PasswordInput } from "@/components/auth/password-input"
import { useSession } from "@/components/session-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import { login } from "@/lib/api/endpoints"

/** Only allow same-app redirects after sign-in. */
function safeRedirect(from: string | null) {
  return from && from.startsWith("/") && !from.startsWith("//")
    ? from
    : "/dashboard"
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { claims, signIn } = useSession()
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const destination = safeRedirect(searchParams.get("from"))

  React.useEffect(() => {
    if (claims) router.replace(destination)
  }, [claims, destination, router])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setPending(true)
    try {
      const response = await login(
        String(form.get("username")),
        String(form.get("password"))
      )
      signIn(response.data.token)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status < 500
          ? "Invalid username or password."
          : "We couldn't reach Wyre. Check your connection and try again."
      )
      setPending(false)
    }
  }

  return (
    <>
      <AuthHeading
        title="Welcome back"
        description="Sign in to your Wyre account."
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
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              autoFocus
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/reset-password"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending && <Spinner />}
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}
