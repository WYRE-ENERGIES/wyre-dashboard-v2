"use client"

import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** The "CSV" export button of the old Raw Logs tables. */
export function CsvButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <DownloadIcon />
      CSV
    </Button>
  )
}
