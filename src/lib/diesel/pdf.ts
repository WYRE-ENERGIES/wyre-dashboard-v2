/**
 * Diesel Overview "Download report": an A4 PDF rendered in the browser
 * (inventory decision #7 keeps this flow). Ported from origin/dev
 * `DieselOverviewPage.js:88-132`, with two fixes:
 * - tall pages continue onto extra A4 pages instead of being clipped;
 * - the title carries the Wyre name and the global period.
 * Elements marked `data-pdf-ignore` (buttons) are left out.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  {
    title,
    subtitle,
    filename,
  }: { title: string; subtitle?: string; filename: string }
) {
  const [{ default: html2canvas }, { jsPDF, GState }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  // Let charts finish their entry animation before capturing.
  await new Promise((resolve) => setTimeout(resolve, 300))

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || null,
    ignoreElements: (el) =>
      el instanceof HTMLElement && el.dataset.pdfIgnore !== undefined,
  })

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const headerH = subtitle ? 24 : 18
  const footerH = 8
  const imgW = pageW - margin * 2
  const pxPerMm = canvas.width / imgW

  // PDF branding is drawn by jsPDF, outside the app's theme: brand purple
  // #5C12A7 for the title, greys for text.
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.setTextColor(92, 18, 167)
  pdf.text(`Wyre · ${title}`, margin, 14)
  if (subtitle) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.setTextColor(90, 90, 100)
    pdf.text(subtitle, margin, 20)
  }

  let offsetPx = 0
  let page = 0
  while (offsetPx < canvas.height) {
    const top = page === 0 ? headerH : margin
    const availMm = pageH - top - footerH
    const slicePx = Math.min(
      canvas.height - offsetPx,
      Math.floor(availMm * pxPerMm)
    )
    const slice = document.createElement("canvas")
    slice.width = canvas.width
    slice.height = slicePx
    slice
      .getContext("2d")
      ?.drawImage(
        canvas,
        0,
        offsetPx,
        canvas.width,
        slicePx,
        0,
        0,
        canvas.width,
        slicePx
      )
    if (page > 0) pdf.addPage()
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      margin,
      top,
      imgW,
      slicePx / pxPerMm
    )
    offsetPx += slicePx
    page += 1
  }

  const generated = new Date().toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  for (let i = 1; i <= page; i++) {
    pdf.setPage(i)
    // Watermark, as in the old report.
    pdf.saveGraphicsState()
    pdf.setGState(new GState({ opacity: 0.08 }))
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(50)
    pdf.setTextColor(120, 120, 130)
    pdf.text("Wyre Energy", pageW / 2, pageH / 2, {
      align: "center",
      angle: 45,
    })
    pdf.restoreGraphicsState()
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 130)
    pdf.text(`Generated ${generated}`, margin, pageH - 4)
    pdf.text(`Page ${i} of ${page}`, pageW - margin, pageH - 4, {
      align: "right",
    })
  }

  pdf.save(filename)
}
