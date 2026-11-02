"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDownIcon,
  CpuIcon,
  MailIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { CardError } from "@/components/shared/card-parts"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  addBillReceiver,
  assignBillDevices,
  getMailSchedules,
  removeBillReceiver,
  sendBill,
} from "@/lib/api/billing"
import type {
  BillFrequency,
  MailSchedules,
  MailSchedulesResponse,
} from "@/lib/api/billing-types"
import { ApiError } from "@/lib/api/client"
import { formatDeviceName } from "@/lib/format"
import { periodLabel, type Period } from "@/lib/period"

const FREQUENCIES: Array<{ value: BillFrequency; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI-WEEKLY", label: "Every two weeks" },
  { value: "MONTHLY", label: "Monthly" },
]

const emailSchema = z.email("Enter a valid email address")

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : undefined

/**
 * "Schedule email" (old components/ScheduleEmailModal.js): external receivers
 * and the devices each one gets, your own devices and frequency, and a
 * one-off "send the bill now" for the selected period.
 */
export function ScheduleEmailDialog({
  userId,
  period,
  selectedDevices,
}: {
  userId: number
  period: Period
  /** Device ids for "send now" (the global selection, else all devices). */
  selectedDevices: number[]
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MailIcon />
        Schedule email
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email bills</DialogTitle>
          <DialogDescription>
            Who gets billing emails, for which devices and how often.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ScheduleEmailBody
            userId={userId}
            period={period}
            selectedDevices={selectedDevices}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleEmailBody({
  userId,
  period,
  selectedDevices,
}: {
  userId: number
  period: Period
  selectedDevices: number[]
}) {
  const queryClient = useQueryClient()
  const queryKey = ["billing", "mail-schedules", userId]
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getMailSchedules(userId, signal),
  })

  /** Writes answer with the updated schedules; use them, or refetch. */
  const applyResponse = (response: MailSchedulesResponse | unknown) => {
    const data = (response as MailSchedulesResponse | null)?.data
    if (data && typeof data === "object" && "available_devices" in data) {
      queryClient.setQueryData<MailSchedulesResponse>(queryKey, { data })
    } else {
      return queryClient.invalidateQueries({ queryKey })
    }
  }

  const assign = useMutation({
    mutationFn: (body: Parameters<typeof assignBillDevices>[1]) =>
      assignBillDevices(userId, body),
    onSuccess: (response) => {
      toast.success("Email settings updated")
      return applyResponse(response)
    },
    onError: (error) =>
      toast.error("Couldn't update email settings", {
        description: errorText(error),
      }),
  })

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (query.isError) return <CardError onRetry={() => query.refetch()} />

  const schedules: MailSchedules = query.data.data ?? {}
  const available = schedules.available_devices ?? []
  const receivers = schedules.external_recievers ?? []
  const mine = (schedules.personal_data?.assigned_devices ?? []).map(
    (d) => d.id
  )
  const frequency = schedules.personal_data?.frequency ?? null

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Your scheduled bill</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DevicePicker
            available={available}
            value={mine}
            disabled={assign.isPending}
            onChange={(ids) => assign.mutate({ selected_devices: ids })}
          />
          <Select
            items={FREQUENCIES}
            value={frequency}
            onValueChange={(value) =>
              value &&
              assign.mutate({
                frequency: value as BillFrequency,
                selected_devices: mine,
              })
            }
            disabled={assign.isPending}
          >
            <SelectTrigger
              size="sm"
              aria-label="Frequency"
              className="min-w-40"
            >
              <SelectValue placeholder="Choose frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Other receivers</h3>
        {receivers.length ? (
          <ul className="flex flex-col gap-2">
            {receivers.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={r.email}
                >
                  {r.email}
                </span>
                <DevicePicker
                  available={available}
                  value={(r.assigned_devices ?? []).map((d) => d.id)}
                  disabled={assign.isPending}
                  onChange={(ids) =>
                    assign.mutate({ receiver_id: r.id, selected_devices: ids })
                  }
                />
                <RemoveReceiver
                  userId={userId}
                  receiver={r}
                  onRemoved={applyResponse}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No other receivers yet.
          </p>
        )}
        <AddReceiver userId={userId} onAdded={applyResponse} />
      </section>

      <Separator />

      <SendNow
        userId={userId}
        period={period}
        selectedDevices={selectedDevices}
      />
    </div>
  )
}

function DevicePicker({
  available,
  value,
  onChange,
  disabled,
}: {
  available: Array<{ device_id: number; device_name: string }>
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const label =
    value.length === 0
      ? "No devices"
      : value.length === 1
        ? "1 device"
        : `${value.length} devices`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={!available.length}
            className="shrink-0"
          >
            <CpuIcon />
            {label}
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Devices on the bill</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {available.map((d) => (
            <DropdownMenuCheckboxItem
              key={d.device_id}
              checked={value.includes(d.device_id)}
              closeOnClick={false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, d.device_id]
                    : value.filter((id) => id !== d.device_id)
                )
              }
            >
              {formatDeviceName(d.device_name)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RemoveReceiver({
  userId,
  receiver,
  onRemoved,
}: {
  userId: number
  receiver: { id: number; email: string }
  onRemoved: (response: unknown) => unknown
}) {
  const remove = useMutation({
    mutationFn: () => removeBillReceiver(userId, receiver.id),
    onSuccess: (response) => {
      toast.success(`Removed ${receiver.email}`)
      return onRemoved(response)
    },
    onError: (error) =>
      toast.error("Couldn't remove the receiver", {
        description: errorText(error),
      }),
  })
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${receiver.email}`}
            disabled={remove.isPending}
          />
        }
      >
        {remove.isPending ? <Spinner /> : <Trash2Icon />}
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this receiver?</AlertDialogTitle>
          <AlertDialogDescription>
            {receiver.email} will stop getting billing emails.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => remove.mutate()}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function EmailForm({
  id,
  placeholder,
  submitLabel,
  icon,
  pending,
  onSubmit,
}: {
  id: string
  placeholder: string
  submitLabel: string
  icon: React.ReactNode
  pending: boolean
  onSubmit: (email: string, reset: () => void) => void
}) {
  const [email, setEmail] = React.useState("")
  const [error, setError] = React.useState("")
  return (
    <form
      noValidate
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = emailSchema.safeParse(email.trim())
        if (!parsed.success)
          return setError(
            parsed.error.issues[0]?.message ?? "Enter a valid email address"
          )
        setError("")
        onSubmit(parsed.data, () => setEmail(""))
      }}
    >
      <div className="flex gap-2">
        <Input
          id={id}
          type="email"
          autoComplete="email"
          placeholder={placeholder}
          value={email}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setEmail(e.target.value)
            setError("")
          }}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="shrink-0"
        >
          {pending ? <Spinner /> : icon}
          {submitLabel}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

function AddReceiver({
  userId,
  onAdded,
}: {
  userId: number
  onAdded: (response: unknown) => unknown
}) {
  const add = useMutation({
    mutationFn: (email: string) => addBillReceiver(userId, email),
    onError: (error) =>
      toast.error("Couldn't add the receiver", {
        description: errorText(error),
      }),
  })
  return (
    <EmailForm
      id="add-bill-receiver"
      placeholder="name@company.com"
      submitLabel="Add"
      icon={<MailIcon />}
      pending={add.isPending}
      onSubmit={(email, reset) =>
        add.mutate(email, {
          onSuccess: (response) => {
            toast.success(`Added ${email}`)
            reset()
            return onAdded(response)
          },
        })
      }
    />
  )
}

function SendNow({
  userId,
  period,
  selectedDevices,
}: {
  userId: number
  period: Period
  selectedDevices: number[]
}) {
  const send = useMutation({
    mutationFn: (email: string) =>
      sendBill(userId, period, email, selectedDevices),
    onError: (error) =>
      toast.error("Couldn't send the bill", { description: errorText(error) }),
  })
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Send a bill now</h3>
      <p className="text-xs text-muted-foreground">
        Emails the bill for {periodLabel(period)}, for the devices in the device
        filter (all devices when none are ticked).
      </p>
      <EmailForm
        id="send-bill-now"
        placeholder="Email address"
        submitLabel="Send"
        icon={<SendIcon />}
        pending={send.isPending}
        onSubmit={(email, reset) =>
          send.mutate(email, {
            onSuccess: () => {
              toast.success(`Bill sent to ${email}`)
              reset()
            },
          })
        }
      />
    </section>
  )
}
