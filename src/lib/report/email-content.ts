/**
 * Daily and periodic reports come from the backend's own email
 * (`preview-report/` → `html_email`), the same email `forward-report/` sends
 * and the scheduled reports use. Only that endpoint carries the diesel
 * figures (branch-reported vs EMS litres and cost, branch efficiency) and the
 * written insights, so the page reads its content from it instead of
 * re-deriving totals from the dashboard endpoints (which gave different
 * numbers).
 *
 * The email is simple, inline-styled HTML: an h1 title, paragraphs, h3
 * section headings each followed by a table or text, and coloured callout
 * divs (h3/h4 title + paragraphs). This turns it into plain blocks the page
 * renders with its own components. Browser-only (DOMParser). The header and
 * footer banners, the "Dashboard Access" promo and the sign-off are dropped.
 */

export type EmailText = { kind: "paragraph"; lines: string[] }
export type EmailList = { kind: "list"; ordered: boolean; items: string[] }
export type EmailTable = {
  kind: "table"
  /** Empty for key/value tables that have no header row. */
  head: string[]
  rows: string[][]
}
export type EmailNoteTone = "warning" | "info" | "success"
export type EmailNoteBlock = {
  kind: "note"
  tone: EmailNoteTone
  title: string
  blocks: Array<EmailText | EmailList | EmailTable>
}
export type EmailBlock =
  | EmailText
  | EmailList
  | EmailTable
  | EmailNoteBlock
  | { kind: "heading"; text: string }

export type ReportEmail = { title: string | null; blocks: EmailBlock[] }

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim()

/** "⚠️ Data Entry Compliance Notice" → "Data Entry Compliance Notice";
 * "Key Insights and Recommendations:" → "Key Insights and Recommendations". */
const headingText = (s: string) =>
  norm(s)
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/:$/, "")

const isSkippedText = (text: string) =>
  /^regards\b/i.test(text) || /dashboard access/i.test(text)

/** Text of an element with `<br>` kept as line breaks. */
function lines(el: Element): string[] {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"))
  return (copy.textContent ?? "").split("\n").map(norm).filter(Boolean)
}

function tone(el: Element): EmailNoteTone {
  const style = (el.getAttribute("style") ?? "").toLowerCase()
  if (/#fff3cd|#f8d7da|#fdecea|#ffeaa7/.test(style)) return "warning"
  if (/#d4edda|#e8f5e9|#c3e6cb/.test(style)) return "success"
  return "info"
}

/** A coloured box: the email's callouts all set a background colour. */
const isCallout = (el: Element) =>
  el.tagName === "DIV" &&
  /background(-color)?\s*:/i.test(el.getAttribute("style") ?? "")

function parseTable(table: HTMLTableElement): EmailTable | null {
  const rows = [...table.rows]
    .map((row) => [...row.cells].map((cell) => norm(cell.textContent)))
    .filter((cells) => cells.some(Boolean))
  if (!rows.length) return null
  const first = table.rows[0]
  const hasHead =
    !!table.tHead ||
    (!!first && [...first.cells].every((cell) => cell.tagName === "TH"))
  return hasHead
    ? { kind: "table", head: rows[0], rows: rows.slice(1) }
    : { kind: "table", head: [], rows }
}

function parseChildren(el: Element, out: EmailBlock[]) {
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      const text = norm(node.textContent)
      if (text && !isSkippedText(text))
        out.push({ kind: "paragraph", lines: [text] })
      continue
    }
    if (node.nodeType !== 1) continue
    const child = node as Element
    const tag = child.tagName
    const text = norm(child.textContent)
    if (!text) continue

    if (/^H[1-6]$/.test(tag)) {
      out.push({ kind: "heading", text: headingText(text) })
    } else if (tag === "P") {
      if (!isSkippedText(text))
        out.push({ kind: "paragraph", lines: lines(child) })
    } else if (tag === "UL" || tag === "OL") {
      const items = [...child.children]
        .filter((li) => li.tagName === "LI")
        .map((li) => norm(li.textContent))
        .filter(Boolean)
      if (items.length) out.push({ kind: "list", ordered: tag === "OL", items })
    } else if (tag === "TABLE") {
      // Layout tables (nested tables inside) are walked, data tables kept.
      if (child.querySelector("table")) parseChildren(child, out)
      else {
        const table = parseTable(child as HTMLTableElement)
        if (table) out.push(table)
      }
    } else if (isCallout(child)) {
      if (/dashboard access/i.test(text)) continue
      const inner: EmailBlock[] = []
      parseChildren(child, inner)
      const titleIndex = inner.findIndex((block) => block.kind === "heading")
      const title =
        titleIndex >= 0 ? (inner[titleIndex] as { text: string }).text : ""
      out.push({
        kind: "note",
        tone: tone(child),
        title,
        blocks: inner.filter(
          (block): block is EmailText | EmailList | EmailTable =>
            block.kind === "paragraph" ||
            block.kind === "list" ||
            block.kind === "table"
        ),
      })
    } else if (tag === "A" || tag === "IMG" || tag === "STYLE") {
      continue
    } else {
      parseChildren(child, out)
    }
  }
}

/** Parses the report email; null when there is no email or it can't be read. */
export function parseReportEmail(
  html: string | null | undefined
): ReportEmail | null {
  if (!html || typeof DOMParser === "undefined") return null
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    // The content sits between the header and footer banners; it is the
    // part with the h1. Fall back to the whole body.
    const h1 = doc.body.querySelector("h1")
    const root =
      (h1 && [...doc.body.children].find((child) => child.contains(h1))) ||
      doc.body
    const blocks: EmailBlock[] = []
    parseChildren(root, blocks)
    const titleIndex = h1
      ? blocks.findIndex(
          (block) =>
            block.kind === "heading" &&
            block.text === headingText(h1.textContent ?? "")
        )
      : -1
    const title =
      titleIndex >= 0
        ? (blocks.splice(titleIndex, 1)[0] as { text: string }).text
        : null
    return blocks.length ? { title, blocks } : null
  } catch {
    return null
  }
}
