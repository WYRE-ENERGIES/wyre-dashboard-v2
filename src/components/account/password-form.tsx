"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { CheckIcon, CircleAlertIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { PasswordInput } from "@/components/auth/password-input"
import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { changePassword } from "@/lib/api/account"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

/**
 * The old change-password policy (mainAppPages/Password.js:92-100):
 * ^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$
 * The special characters are the old page's set, which the backend may also
 * enforce.
 */
const SPECIALS = "#?!@$%^&*-"
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /\d/.test(p) },
  {
    label: `A special character (${SPECIALS.split("").join(" ")})`,
    test: (p: string) => /[#?!@$%^&*-]/.test(p),
  },
]

const schema = z
  .object({
    oldPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .refine(
        (p) => RULES.every((r) => r.test(p)),
        "Your new password doesn't meet every rule yet"
      ),
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.confirmPassword === v.newPassword, {
    path: ["confirmPassword"],
    message: "The new passwords don't match",
  })
  .refine((v) => !v.newPassword || v.newPassword !== v.oldPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one",
  })

type Values = z.infer<typeof schema>

export function PasswordForm() {
  const { username } = useClaims()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  })
  const newPassword = useWatch({ control: form.control, name: "newPassword" })
  const { errors } = form.formState

  const change = useMutation({
    mutationFn: (values: Values) =>
      changePassword(username, values.oldPassword, values.newPassword),
    onSuccess: () => {
      toast.success("Password updated", {
        description: "Use your new password next time you sign in.",
      })
      form.reset()
    },
  })

  return (
    <>
      <PageHeader
        title="Password"
        description="Change the password you sign in with."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Signed in as{" "}
            <span className="font-medium text-foreground">{username}</span>.
            Forgot your current password?{" "}
            <Link
              href="/reset-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Reset it by email
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => change.mutate(values))}
          >
            <FieldGroup>
              {change.isError && (
                <Alert variant="destructive">
                  <CircleAlertIcon />
                  <AlertDescription>
                    {change.error instanceof ApiError &&
                    change.error.status < 500
                      ? change.error.message
                      : "We couldn't change your password. Please try again."}
                  </AlertDescription>
                </Alert>
              )}
              {/* Lets password managers tie the change to the right account. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                readOnly
                hidden
              />
              <Field data-invalid={Boolean(errors.oldPassword)}>
                <FieldLabel htmlFor="old-password">Current password</FieldLabel>
                <PasswordInput
                  id="old-password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.oldPassword)}
                  {...form.register("oldPassword")}
                />
                <FieldError errors={[errors.oldPassword]} />
              </Field>
              <Field data-invalid={Boolean(errors.newPassword)}>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby="password-rules"
                  {...form.register("newPassword")}
                />
                <ul
                  id="password-rules"
                  className="mt-1 grid gap-1 text-xs"
                  aria-label="Password requirements"
                >
                  {RULES.map((rule) => {
                    const ok = rule.test(newPassword)
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
                <FieldError errors={[errors.newPassword]} />
              </Field>
              <Field data-invalid={Boolean(errors.confirmPassword)}>
                <FieldLabel htmlFor="confirm-password">
                  Re-enter new password
                </FieldLabel>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...form.register("confirmPassword")}
                />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
              <Button
                type="submit"
                disabled={change.isPending}
                className="w-full sm:w-fit"
              >
                {change.isPending && <Spinner />}
                {change.isPending ? "Changing…" : "Change password"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
