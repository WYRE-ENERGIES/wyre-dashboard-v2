"use client"

import { useQuery } from "@tanstack/react-query"

import {
  EmailNote,
  EmailReport,
  EmailSection,
} from "@/components/report/email-report"
import { CardError } from "@/components/shared/card-parts"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getReportPreview } from "@/lib/api/report"
import type { ReportRequest } from "@/lib/api/report-types"
import {
  parseReportEmail,
  type EmailBlock,
  type EmailList,
  type EmailNoteTone,
  type EmailTable,
  type EmailText,
} from "@/lib/report/email-content"
import { reportRequestKey } from "@/lib/report/report-request"
import { cn } from "@/lib/utils"

type PeriodRequest = Exclude<ReportRequest, { report_type: "monthly" }>

const FALLBACK_TITLE: Record<PeriodRequest["report_type"], string> = {
  daily: "Daily Energy Usage Report",
  periodic: "Periodic Energy Usage Report",
}

const NOTE_TONE: Record<EmailNoteTone, "warning" | "savings" | "month"> = {
  warning: "warning",
  success: "savings",
  info: "month",
}

/**
 * Daily and periodic reports, on the email paper, with the content of the
 * backend's own email (`preview-report/`, see lib/report/email-content):
 * the same figures, diesel comparisons and insights recipients get. Shares
 * its query with "Email version", so both show the same response (the
 * written insights are generated per request).
 */
export function PeriodReport({ request }: { request: PeriodRequest }) {
  const query = useQuery({
    queryKey: ["report", "preview", reportRequestKey(request)],
    queryFn: ({ signal }) => getReportPreview(request, signal),
    select: (data) => parseReportEmail(data?.html_email),
  })
  const fallback = FALLBACK_TITLE[request.report_type]

  if (query.isPending) {
    return (
      <EmailReport title={fallback}>
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </EmailReport>
    )
  }
  if (query.isError) {
    return (
      <EmailReport title={fallback}>
        <CardError onRetry={() => query.refetch()} />
      </EmailReport>
    )
  }
  if (!query.data) {
    return (
      <EmailReport title={fallback}>
        <p className="py-10 text-center text-sm text-muted-foreground">
          No report is available for this period.
        </p>
      </EmailReport>
    )
  }

  const { title, blocks } = query.data
  const { intro, sections } = groupSections(blocks)
  return (
    <EmailReport title={title ?? fallback}>
      {intro.length > 0 && (
        <div className="flex flex-col gap-4">
          {intro.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      )}
      {sections.map((section, index) => (
        <EmailSection key={`${section.title}-${index}`} title={section.title}>
          {section.blocks.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} />
          ))}
        </EmailSection>
      ))}
    </EmailReport>
  )
}

type ContentBlock = Exclude<EmailBlock, { kind: "heading" }>
type Section = { title: string; blocks: ContentBlock[] }

/** Blocks before the first heading are the greeting and notices; each
 * heading starts a section. */
function groupSections(blocks: EmailBlock[]) {
  const intro: ContentBlock[] = []
  const sections: Section[] = []
  for (const block of blocks) {
    if (block.kind === "heading") {
      sections.push({ title: block.text, blocks: [] })
    } else if (sections.length) {
      sections[sections.length - 1].blocks.push(block)
    } else {
      intro.push(block)
    }
  }
  return { intro, sections: sections.filter((s) => s.blocks.length) }
}

function Block({ block }: { block: ContentBlock }) {
  if (block.kind === "note") {
    return (
      <EmailNote tone={NOTE_TONE[block.tone]} title={block.title}>
        <div className="flex flex-col gap-2">
          {block.blocks.map((inner, index) => (
            <Block key={index} block={inner} />
          ))}
        </div>
      </EmailNote>
    )
  }
  if (block.kind === "table") return <EmailTableView table={block} />
  if (block.kind === "list") return <ListView list={block} />
  return <TextView text={block} />
}

function TextView({ text }: { text: EmailText }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {text.lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  )
}

function ListView({ list }: { list: EmailList }) {
  const Tag = list.ordered ? "ol" : "ul"
  return (
    <Tag
      className={cn(
        "flex flex-col gap-1 pl-5 text-sm",
        list.ordered ? "list-decimal" : "list-disc"
      )}
    >
      {list.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  )
}

/** Figures ("1,340.4", "₦0.00", "0.0 (0%)", "N/A L") line up on the right;
 * labels stay on the left. */
const isFigure = (cell: string) =>
  /^[-−+]?[₦$]?\s?(\d[\d,]*(\.\d+)?|N\/A)/.test(cell) || cell === "-"

const isTotalRow = (row: string[]) => /^total\b/i.test(row[0] ?? "")

function EmailTableView({ table }: { table: EmailTable }) {
  const keyValue = table.head.length === 0
  // A column is right-aligned when every filled cell in it is a figure
  // ("Notes" and "Generators breakdown" stay left).
  const width = Math.max(table.head.length, ...table.rows.map((r) => r.length))
  const figures = Array.from(
    { length: width },
    (_, i) => i > 0 && table.rows.every((row) => !row[i] || isFigure(row[i]))
  )
  return (
    <Table>
      {!keyValue && (
        <TableHeader>
          <TableRow>
            {table.head.map((cell, index) => (
              <TableHead
                key={index}
                className={cn(
                  "min-w-28 align-bottom whitespace-normal",
                  figures[index] && "text-right"
                )}
              >
                {cell}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {table.rows.map((row, rowIndex) => (
          <TableRow
            key={rowIndex}
            className={cn(isTotalRow(row) && "bg-muted/50 font-semibold")}
          >
            {row.map((cell, index) => (
              <TableCell
                key={index}
                className={cn(
                  "tabular-nums",
                  index === 0
                    ? "min-w-40 font-medium whitespace-normal"
                    : figures[index]
                      ? "text-right whitespace-nowrap"
                      : "min-w-40 whitespace-normal"
                )}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
