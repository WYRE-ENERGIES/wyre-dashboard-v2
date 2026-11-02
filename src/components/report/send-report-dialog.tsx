"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { SendIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { sendReport } from "@/lib/api/report"
import type { ReportRequest } from "@/lib/api/report-types"
import { REPORT_TYPE_LABEL } from "@/lib/report/report-request"

const MAX_CC = 10
const email = z.email()
const splitList = (value: string) =>
  value
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

const schema = z
  .object({
    recipient: z
      .string()
      .trim()
      .min(1, "Enter the recipient's email.")
      .pipe(z.email("Enter a valid email address.")),
    cc: z.string(),
  })
  .superRefine(({ recipient, cc }, ctx) => {
    const list = splitList(cc)
    const invalid = list.filter((e) => !email.safeParse(e).success)
    if (invalid.length) {
      ctx.addIssue({
        code: "custom",
        path: ["cc"],
        message: `Not a valid email: ${invalid.join(", ")}`,
      })
    } else if (list.length > MAX_CC) {
      ctx.addIssue({
        code: "custom",
        path: ["cc"],
        message: `Add at most ${MAX_CC} CC addresses.`,
      })
    } else if (list.some((e) => e.toLowerCase() === recipient.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["cc"],
        message: "The recipient is already on the To line.",
      })
    }
  })

type FormValues = z.input<typeof schema>

/** "Send report" (old SendReportPanel.js): POST forward-report/ with the
 * report the page shows, a recipient and optional CC (`carbon_copy`, which
 * the old UI always sent empty). */
export function SendReportDialog({
  request,
  title,
  disabled,
}: {
  request: ReportRequest | null
  title: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { recipient: "", cc: "" },
  })

  const mutation = useMutation({
    mutationFn: ({
      values,
      report,
    }: {
      values: FormValues
      report: ReportRequest
    }) => {
      const unique = [
        ...new Set(splitList(values.cc).map((e) => e.toLowerCase())),
      ]
      return sendReport(report, values.recipient.trim(), unique)
    },
    onSuccess: (_data, { values, report }) => {
      toast.success(
        `${REPORT_TYPE_LABEL[report.report_type]} report sent to ${values.recipient.trim()}`
      )
      form.reset()
      setOpen(false)
    },
    onError: () =>
      toast.error("Couldn't send the report. Try again in a moment."),
  })

  const errors = form.formState.errors

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger render={<Button disabled={disabled || !request} />}>
        <SendIcon />
        Send report
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={form.handleSubmit(
            (values) => request && mutation.mutate({ values, report: request })
          )}
          noValidate
          className="grid gap-6"
        >
          <DialogHeader>
            <DialogTitle>Send report</DialogTitle>
            <DialogDescription>
              Email the{" "}
              {request
                ? REPORT_TYPE_LABEL[request.report_type].toLowerCase()
                : ""}{" "}
              report for {title}.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.recipient || undefined}>
              <FieldLabel htmlFor="report-recipient">To</FieldLabel>
              <Input
                id="report-recipient"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                aria-invalid={!!errors.recipient}
                {...form.register("recipient")}
              />
              <FieldError errors={[errors.recipient]} />
            </Field>
            <Field data-invalid={!!errors.cc || undefined}>
              <FieldLabel htmlFor="report-cc">CC (optional)</FieldLabel>
              <Input
                id="report-cc"
                type="text"
                inputMode="email"
                placeholder="ops@company.com, finance@company.com"
                aria-invalid={!!errors.cc}
                {...form.register("cc")}
              />
              {errors.cc ? (
                <FieldError errors={[errors.cc]} />
              ) : (
                <FieldDescription>
                  Separate addresses with commas.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
