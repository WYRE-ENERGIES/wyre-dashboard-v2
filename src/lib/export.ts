/** Client-side file exports (the old app's "CSV" buttons). */

type Cell = string | number | boolean | null | undefined

function escapeCsv(value: Cell) {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Download rows as a CSV file. `headers` maps column keys to header labels. */
export function downloadCsv<T extends Record<string, Cell>>(
  filename: string,
  headers: Array<{ key: keyof T & string; label: string }>,
  rows: T[]
) {
  const lines = [
    headers.map((h) => escapeCsv(h.label)).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h.key])).join(",")),
  ]
  // BOM so Excel opens UTF-8 (₦ etc.) correctly.
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** A filename-safe slug, e.g. for "Power demand – Lekki Branch – Oct 2026". */
export function fileSlug(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
