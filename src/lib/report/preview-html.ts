/**
 * Clean-up of the server-rendered report email before previewing it on the
 * page. Ported from the old components/ReportIframePreview.js
 * (`stripDashboardAccessSectionFromPreviewHtml`): the email carries a
 * "Dashboard Access" promo and a "View Dashboard" button, which make no sense
 * inside the dashboard. The emailed report is unchanged. Browser-only
 * (DOMParser); returns the input unchanged if parsing fails.
 */

const normText = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim()
const CTA = /for full details|visit your dashboard|view\s+dashboard/i

/** Promo block mentions dashboard access; skip nodes that also hold the sign-off. */
function isDashboardAccessCallout(text: string) {
  const t = normText(text)
  if (!/dashboard access/i.test(t)) return false
  if (/regards,?\s*wyre/i.test(t)) return false
  return CTA.test(t) || t.length < 800
}

export function stripDashboardAccessSection(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const body = doc.body
    if (!body) return html

    // 1) Nested tables used as the callout card (smallest match first).
    ;[...body.querySelectorAll("table")]
      .map((el) => ({ el, t: normText(el.textContent) }))
      .filter(({ t }) => isDashboardAccessCallout(t) && t.length <= 4000)
      .sort((a, b) => a.t.length - b.t.length)
      .forEach(({ el }) => el.remove())

    // 2) Div-based callouts (deepest first).
    ;[...body.querySelectorAll("div")].reverse().forEach((div) => {
      const t = normText(div.textContent)
      if (isDashboardAccessCallout(t) && t.length <= 4000) div.remove()
    })

    // 3) A promo split across consecutive <tr> rows of the main layout.
    for (const tr of [...body.querySelectorAll("tr")]) {
      if (!tr.isConnected) continue
      const t = normText(tr.textContent)
      if (/regards/i.test(t) || !/dashboard access/i.test(t)) continue
      if (CTA.test(t)) {
        tr.remove()
        continue
      }
      const chunk: Element[] = [tr]
      let next = tr.nextElementSibling
      while (next && next.tagName === "TR" && chunk.length < 12) {
        const nt = normText(next.textContent)
        if (/regards/i.test(nt)) break
        if (nt.length > 250 && !/dashboard access/i.test(nt) && !CTA.test(nt))
          break
        chunk.push(next)
        if (CTA.test(nt)) {
          chunk.forEach((row) => row.remove())
          break
        }
        next = next.nextElementSibling
      }
    }

    // 4) Any remaining "View Dashboard" controls.
    const ctas = [
      ...body.querySelectorAll(
        "a, button, [role='button'], input[type='submit'], input[type='button']"
      ),
    ].filter((el) => /view\s+dashboard/i.test(normText(el.textContent)))
    for (const el of ctas) {
      const row = el.closest("tr")
      if (!row) {
        el.remove()
        continue
      }
      const prev = row.previousElementSibling
      row.remove()
      if (
        prev?.tagName === "TR" &&
        /dashboard access/i.test(prev.textContent ?? "")
      )
        prev.remove()
    }

    // Links in the email open in a new tab rather than inside the frame.
    const baseEl = doc.createElement("base")
    baseEl.setAttribute("target", "_blank")
    doc.head.prepend(baseEl)

    return "<!doctype html>" + doc.documentElement.outerHTML
  } catch {
    return html
  }
}
