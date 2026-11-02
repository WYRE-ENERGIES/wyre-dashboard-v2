"use client"

import * as React from "react"
import Link from "next/link"
import {
  EllipsisVerticalIcon,
  PencilIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

/**
 * The "More" menu on a register row: Edit opens the caller's dialog, Delete
 * asks for confirmation first (AlertDialog) and stays open while the
 * request runs.
 */
export function RowActions({
  label,
  onEdit,
  onDelete,
  editDisabledReason,
  deleteDescription,
}: {
  /** e.g. "diesel purchase", used in menu items and the confirmation. */
  label: string
  onEdit?: () => void
  onDelete?: () => Promise<unknown>
  /** When set, Edit is disabled and this explains why. */
  editDisabledReason?: string
  deleteDescription?: string
}) {
  const [confirming, setConfirming] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function confirmDelete() {
    if (!onDelete) return
    setPending(true)
    try {
      await onDelete()
      setConfirming(false)
    } catch {
      // The mutation shows the error toast; keep the dialog open to retry.
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for this ${label}`}
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit} disabled={!!editDisabledReason}>
              <PencilIcon />
              <span className="flex flex-col">
                Edit {label}
                {editDisabledReason && (
                  <span className="text-xs text-muted-foreground">
                    {editDisabledReason}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2Icon />
              Delete {label}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !pending && setConfirming(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDescription ??
                "This permanently removes the record. It can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Dialog shell for the edit forms. */
export function EditDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Shown instead of an operator-only page (old UnAuthorizeResponse). */
export function NotAllowed({ what }: { what: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Not allowed</EmptyTitle>
        <EmptyDescription>
          Only operators can {what}. Ask an operator on your account if
          something needs recording.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/cost-tracker" />}
        >
          Back to Cost Tracker
        </Button>
      </EmptyContent>
    </Empty>
  )
}
