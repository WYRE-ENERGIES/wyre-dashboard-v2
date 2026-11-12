"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * The app's table: sortable headers, client-side pagination (at most
 * MAX_PAGE_SIZE rows a page), loading and empty states, and an optional
 * footer row (totals). Column `meta.align` set to "right" right-aligns
 * numbers.
 *
 *   <DataTable columns={columns} data={rows} isLoading={query.isPending} />
 */
/** No table shows more rows than this at once; the rest are on later pages. */
export const MAX_PAGE_SIZE = 10

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyText = "No data for this period.",
  pageSize = MAX_PAGE_SIZE,
  footer,
  className,
}: {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  emptyText?: string
  /** Rows per page, capped at MAX_PAGE_SIZE. */
  pageSize?: number
  /** Cells for a totals row, keyed by column id. */
  footer?: Record<string, React.ReactNode>
  className?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const size = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE))
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not compiler-safe yet
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: size } },
  })

  const align = (meta: unknown) =>
    (meta as { align?: string } | undefined)?.align === "right"
      ? "text-right"
      : ""
  const rows = table.getRowModel().rows

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        align(header.column.columnDef.meta)
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            align(header.column.columnDef.meta) &&
                              "flex-row-reverse"
                          )}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap tabular-nums",
                        align(cell.column.columnDef.meta)
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footer && !isLoading && rows.length > 0 && (
            <TableFooter>
              <TableRow>
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      "font-medium whitespace-nowrap tabular-nums",
                      align(column.columnDef.meta)
                    )}
                  >
                    {footer[column.id] ?? null}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {table.getPageCount() > 1 && <Pager table={table} total={data.length} />}
    </div>
  )
}

/** "1–10 of 24 rows", then previous, page numbers and next. */
function Pager<TData>({
  table,
  total,
}: {
  table: ReturnType<typeof useReactTable<TData>>
  total: number
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pages = table.getPageCount()
  const first = pageIndex * pageSize + 1
  const last = Math.min(total, first + pageSize - 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {first}–{last} of {total} rows
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeftIcon />
        </Button>
        {pageNumbers(pageIndex, pages).map((page, i) =>
          page === null ? (
            <span key={`gap-${i}`} className="px-1" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === pageIndex ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={`Page ${page + 1}`}
              aria-current={page === pageIndex ? "page" : undefined}
              className="tabular-nums"
              onClick={() => table.setPageIndex(page)}
            >
              {page + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

/** Zero-based page indexes to show, with `null` for a gap: the first and
 * last page, and the current page with one neighbour on each side. */
function pageNumbers(current: number, count: number): Array<number | null> {
  const keep = new Set([0, count - 1, current - 1, current, current + 1])
  const out: Array<number | null> = []
  for (let page = 0; page < count; page++) {
    if (!keep.has(page)) continue
    const previous = out.at(-1)
    if (typeof previous === "number" && page - previous > 1) out.push(null)
    out.push(page)
  }
  return out
}
