import {
  format,
  isWeekend,
  parseISO,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns"

import type {
  MonthlyReportResponse,
  PreviewReportResponse,
  ReportDeviceEntry,
  ReportPeriodDevices,
  ReportRequest,
} from "@/lib/api/report-types"
import {
  currentBranch,
  daysOf,
  DEVICES,
  hourlyKwh,
  noise,
  totals,
  wait,
} from "@/lib/demo"
import { periodEnd, periodStart, type Period } from "@/lib/period"

/**
 * Demo Report data, built from the same hourly series as the dashboard.
 * Lekki (branch 1) is a solar site, so its monthly report shows the solar
 * savings and battery sections; Ikeja and Abuja are non-solar and show the
 * top contributors, solar-hours and usage-breakdown sections instead.
 */

const TARIFF = 209 // ₦/kWh, utility
const DIESEL_PRICE = 1150 // ₦/L
const ACHIEVED_KWH_PER_L = 3.2
const OPTIMAL_KWH_PER_L = 3.496

const kwhText = (n: number) =>
  `${n.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kWh`
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

const isSolarSite = () => currentBranch().id === 1
const sources = () =>
  DEVICES.filter((d) => d.device_type !== "SOLAR" || isSolarSite())

const monthPeriod = (month: number, year: number): Period => ({
  kind: "month",
  anchor: new Date(year, month - 1, 1),
})

function periodDevices(period: Period, totalKwh: number): ReportPeriodDevices {
  const month = format(period.anchor, "MMMM")
  const t = totals(period).filter(({ device }) => sources().includes(device))
  const seed = Number(format(period.anchor, "yyyyMM"))
  const gens = t.filter(({ device }) => device.device_type === "GENERATOR")
  const dieselLitres = gens.reduce((s, g) => s + g.kwh / ACHIEVED_KWH_PER_L, 0)

  const utility: ReportDeviceEntry[] = t
    .filter(({ device }) => device.device_type === "UTILITY")
    .map(({ device, kwh }) => {
      const disco = kwh * (1.01 + noise(seed + 3) * 0.08)
      return {
        name: device.name,
        month,
        device_energy: kwhText(kwh),
        actual_energy: r1(disco),
        expected_bill: Math.round(kwh * TARIFF),
        actual_cost: Math.round(disco * TARIFF),
        usage_accuracy: `${r1((kwh / disco) * 100)}%`,
        time_of_use: 0,
      }
    })

  const entries: ReportDeviceEntry[] = gens.map(({ device, kwh }, i) => ({
    name: device.name,
    month,
    device_energy: kwhText(kwh),
    optimal_usage: `${r1(kwh / OPTIMAL_KWH_PER_L)} L`,
    optimal_cost: Math.round((kwh / OPTIMAL_KWH_PER_L) * DIESEL_PRICE),
    actual_cost: Math.round(dieselLitres * DIESEL_PRICE),
    last_bill_accuracy: r2(88 + noise(seed + i) * 10),
  }))

  const solar = t
    .filter(({ device }) => device.device_type === "SOLAR")
    .map(({ kwh }) => ({
      name: "Solar_Inverter",
      device_energy: kwhText(kwh),
      solar_energy: r1(kwh),
      savings: Math.round(kwh * TARIFF),
      contribution: totalKwh ? r1((kwh / (totalKwh + kwh)) * 100) : 0,
      period_detail: `${format(period.anchor, "MMM d")} – ${format(periodEnd(period), "MMM d, yyyy")}`,
    }))

  return {
    devices: {
      utility,
      generator: { entries, actual_usage: r1(dieselLitres) },
      solar,
    },
  }
}

function nonSolarKwh(period: Period) {
  return totals(period)
    .filter(({ device }) => device.device_type !== "SOLAR")
    .reduce((s, t) => s + t.kwh, 0)
}

export function demoMonthlyReport(month: number, year: number) {
  const period = monthPeriod(month, year)
  const prev1 = { ...period, anchor: subMonths(period.anchor, 1) }
  const prev2 = { ...period, anchor: subMonths(period.anchor, 2) }
  const yearPeriod: Period = {
    kind: "year",
    anchor: startOfYear(period.anchor),
  }
  const seed = year * 100 + month
  const solarSite = isSolarSite()
  const days = daysOf(period)
  const end = periodEnd(period).getTime()
  const scale = currentBranch().scale

  // Energy by operating segment (weekdays 8am–6pm are operational hours).
  const seg = { operational: 0, non_operational: 0, weekends: 0 }
  const peaks = { operational: 0, non_operational: 0, weekends: 0 }
  let solarHoursKwh = 0
  let utilityHours = 0
  let offHoursGenKwh = 0
  let offHoursGenHours = 0
  for (const day of days) {
    for (let h = 0; h < 24; h++) {
      if (day.getTime() + h * 3_600_000 > end) break
      const perDevice = sources().map((d) => ({ d, v: hourlyKwh(d, day, h) }))
      const load = perDevice.reduce((s, x) => s + x.v, 0)
      const key = isWeekend(day)
        ? "weekends"
        : h >= 8 && h < 18
          ? "operational"
          : "non_operational"
      seg[key] += load
      peaks[key] = Math.max(peaks[key], load / 0.85)
      if (h >= 8 && h < 18)
        solarHoursKwh += perDevice
          .filter((x) => x.d.device_type !== "SOLAR")
          .reduce((s, x) => s + x.v, 0)
      if (perDevice.some((x) => x.d.device_type === "UTILITY" && x.v > 0))
        utilityHours += 1
      const gen = perDevice
        .filter((x) => x.d.device_type === "GENERATOR")
        .reduce((s, x) => s + x.v, 0)
      if (key !== "operational" && gen > 0) {
        offHoursGenKwh += gen
        offHoursGenHours += 1
      }
    }
  }
  const segment = (key: keyof typeof seg, hours: number) => ({
    peak: r1(peaks[key]),
    average: r1(hours ? seg[key] / hours / 0.85 : 0),
    minimum: r1(peaks[key] * 0.22),
    total_energy: kwhText(seg[key]).replace(" ", ""),
    unit: "kVA",
  })
  const elapsedDays = days.filter((d) => d.getTime() <= end)
  const weekendDays = elapsedDays.filter((d) => isWeekend(d)).length
  const weekDays = elapsedDays.length - weekendDays

  const totalKwh = nonSolarKwh(period)
  const deviation = (p: Period, factor: number) => {
    const kwh = offHoursGenKwh * factor
    return {
      month: format(p.anchor, "MMMM"),
      name: "Energy(KWH)",
      value: r1(kwh),
      deviation_time_of_use: r1(offHoursGenHours * factor * 0.5),
      diesel_consumption: r1(kwh / ACHIEVED_KWH_PER_L),
      deviation_cost: Math.round((kwh / ACHIEVED_KWH_PER_L) * DIESEL_PRICE),
    }
  }

  const solarDevice = DEVICES.find((d) => d.device_type === "SOLAR")!
  const response: MonthlyReportResponse = {
    branch_name: currentBranch().name,
    month: format(period.anchor, "MMMM").toLowerCase(),
    year: String(year),
    has_solar: solarSite,
    branch_type: "commercial",
    is_commercial: true,
    total_energy: { value: r1(totalKwh), unit: "kWh" },
    solar_hour: { value: r1(solarHoursKwh), unit: "kWh" },
    energy_generated: {
      current_month: periodDevices(period, totalKwh),
      previous_month_1: periodDevices(prev1, nonSolarKwh(prev1)),
      previous_month_2: periodDevices(prev2, nonSolarKwh(prev2)),
      ...(solarSite
        ? {
            this_year: periodDevices(yearPeriod, nonSolarKwh(yearPeriod)),
            since_commission: (() => {
              const y = periodDevices(yearPeriod, nonSolarKwh(yearPeriod))
              const s = y.devices!.solar![0]
              const k = 2.6 // commissioned in 2024
              return {
                devices: {
                  solar: [
                    {
                      ...s,
                      solar_energy: r1(Number(s.solar_energy) * k),
                      savings: Math.round(Number(s.savings) * k),
                      period_detail: `Mar 4, 2024 – ${format(periodEnd(period), "MMM d, yyyy")}`,
                    },
                  ],
                },
              }
            })(),
          }
        : {}),
    },
    power_demand: {
      operational: segment("operational", weekDays * 10),
      non_operational: segment("non_operational", weekDays * 14),
      weekends: segment("weekends", weekendDays * 24),
    },
    energy_deviation_and_cost: {
      current_month: deviation(period, 1),
      previous_month_1: deviation(prev1, 0.86 + noise(seed + 1) * 0.3),
      previous_month_2: deviation(prev2, 0.9 + noise(seed + 2) * 0.3),
    },
    generator_size_efficiency: {
      current_month: {
        value: r1(36 + noise(seed) * 14),
        unit: "%",
        date: format(period.anchor, "MM/yyyy"),
      },
      previous_month: {
        value: r1(36 + noise(seed - 1) * 14),
        unit: "%",
        date: format(prev1.anchor, "MM/yyyy"),
      },
      best_month: { value: 51.8, unit: "%", date: "04/2026" },
    },
    fuel_efficiency_accuracy_comparison: {
      accuracy: {
        value: r1((ACHIEVED_KWH_PER_L / OPTIMAL_KWH_PER_L) * 100),
        unit: "%",
      },
      recommended: { value: OPTIMAL_KWH_PER_L, unit: "kWh/L" },
      achieved: { value: ACHIEVED_KWH_PER_L, unit: "kWh/L" },
    },
    utility_band_categorization: [
      {
        band: "A",
        expected_hours: days.length * 20,
        total_hours: utilityHours,
      },
    ],
    data_entry: { value: Math.round(62 + noise(seed + 9) * 33), unit: "%" },
    ...(solarSite
      ? {
          battery_daily_usage: {
            month: format(period.anchor, "MMMM"),
            year: String(year),
            days: days
              .filter((d) => d.getTime() <= end)
              .map((d) => {
                const n = noise(Number(format(d, "yyyyMMdd")) + 77)
                const solar = Array.from({ length: 24 }, (_, h) =>
                  hourlyKwh(solarDevice, d, h)
                ).reduce((a, b) => a + b, 0)
                return {
                  date: format(d, "yyyy-MM-dd"),
                  discharge_kwh: r1(solar * 0.35 * scale * (0.7 + n * 0.5)),
                  discharge_hours: r2(3 + n * 6),
                  max_soc: Math.round(72 + n * 28),
                }
              }),
          },
        }
      : {}),
  }
  return wait(response)
}

// ---------------------------------------------------------------------------
// Daily / periodic HTML email (what preview-report returns).

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`
const kwh = (n: number) =>
  `${n.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kWh`

function breakdown(period: Period) {
  const t = totals(period).filter(({ device }) => sources().includes(device))
  const grid = t
    .filter((x) => x.device.device_type === "UTILITY")
    .reduce((s, x) => s + x.kwh, 0)
  const gens = t.filter((x) => x.device.device_type === "GENERATOR")
  const genKwh = gens.reduce((s, x) => s + x.kwh, 0)
  const solar = t
    .filter((x) => x.device.device_type === "SOLAR")
    .reduce((s, x) => s + x.kwh, 0)
  return { grid, gens, genKwh, solar, total: grid + genKwh + solar }
}

function emailShell(
  title: string,
  subtitle: string,
  body: string,
  year: number
) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f4f1f8;font-family:Arial,Helvetica,sans-serif;color:#1f1a29">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#5c12a7;color:#ffffff;padding:24px">
<div style="font-size:22px;font-weight:bold">wyre<span style="color:#fcd642">.</span></div>
<div style="font-size:18px;margin-top:12px">${title}</div>
<div style="font-size:13px;opacity:.85;margin-top:4px">${subtitle}</div></td></tr>
${body}
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" style="background:#f7f2fd;border-radius:8px"><tr><td style="padding:16px">
<strong>Dashboard Access</strong><p style="margin:6px 0 12px;font-size:13px">For full details, visit your dashboard.</p>
<a href="https://dashboard.wyreng.com" style="display:inline-block;background:#5c12a7;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px">View Dashboard</a>
</td></tr></table></td></tr>
<tr><td style="padding:16px 24px 24px;font-size:13px">Regards,<br>Wyre</td></tr>
<tr><td style="padding:12px 24px;background:#faf8fc;font-size:11px;color:#7a7287;text-align:center">© ${year} Wyre. This is a sample report generated in demo mode.</td></tr>
</table></td></tr></table></body></html>`
}

const section = (heading: string, inner: string) =>
  `<tr><td style="padding:16px 24px 0"><h2 style="font-size:15px;margin:0 0 8px;color:#5c12a7">${heading}</h2>${inner}</td></tr>`

const table = (head: string[], rows: string[][]) =>
  `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px">
<tr>${head.map((h, i) => `<th align="${i ? "right" : "left"}" style="border-bottom:1px solid #e6e0ee;color:#7a7287;font-weight:normal">${h}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => `<td align="${i ? "right" : "left"}" style="border-bottom:1px solid #f1edf6">${c}</td>`).join("")}</tr>`).join("")}</table>`

function previousWorkingDay(date: Date) {
  let d = subDays(date, 1)
  while (isWeekend(d)) d = subDays(d, 1)
  return d
}

function dailyEmail(date: Date) {
  const period: Period = { kind: "day", anchor: date }
  const b = breakdown(period)
  const prevDate = previousWorkingDay(date)
  const prev = breakdown({ kind: "day", anchor: prevDate })
  const dieselRef = b.genKwh / OPTIMAL_KWH_PER_L
  const change = prev.total ? ((b.total - prev.total) / prev.total) * 100 : 0
  const body = [
    section(
      "Data entry compliance",
      `<p style="margin:0;font-size:13px;background:#fff8dc;border-radius:6px;padding:10px">No diesel purchase was logged for ${format(date, "d MMM")}. Log diesel entries daily so cost and fuel-efficiency figures stay accurate.</p>`
    ),
    section(
      "Energy and cost breakdown",
      table(
        ["Source", "Energy", "Estimated cost"],
        [
          ["Grid (utility)", kwh(b.grid), naira(b.grid * TARIFF)],
          ...b.gens.map((g) => [
            g.device.name.replace(/_/g, " ") + " (EMS benchmark)",
            kwh(g.kwh),
            naira((g.kwh / OPTIMAL_KWH_PER_L) * DIESEL_PRICE),
          ]),
          ...(b.solar ? [["Solar", kwh(b.solar), naira(0)]] : []),
          [
            "<strong>Total</strong>",
            `<strong>${kwh(b.total)}</strong>`,
            `<strong>${naira(b.grid * TARIFF + dieselRef * DIESEL_PRICE)}</strong>`,
          ],
        ]
      )
    ),
    section(
      "Calculated diesel reference",
      `<p style="margin:0;font-size:13px">Generators supplied ${kwh(b.genKwh)}. At ${OPTIMAL_KWH_PER_L} kWh/L that is about <strong>${dieselRef.toLocaleString("en-NG", { maximumFractionDigits: 2 })} L</strong> of diesel. Compare it with the branch-reported quantity.</p>`
    ),
    section(
      "Compared with the previous working day",
      table(
        ["", format(prevDate, "EEE d MMM"), format(date, "EEE d MMM")],
        [
          ["Total energy", kwh(prev.total), kwh(b.total)],
          ["Grid", kwh(prev.grid), kwh(b.grid)],
          ["Generators", kwh(prev.genKwh), kwh(b.genKwh)],
        ]
      ) +
        `<p style="margin:8px 0 0;font-size:13px">Total energy is ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% on the previous working day.</p>`
    ),
  ].join("")
  return emailShell(
    `Daily energy report · ${currentBranch().name}`,
    format(date, "EEEE d MMMM yyyy"),
    body,
    date.getFullYear()
  )
}

function periodicEmail(period: Period) {
  const start = periodStart(period)
  const end = periodEnd(period)
  const b = breakdown(period)
  const months: string[][] = []
  for (
    let m = new Date(start);
    m <= end;
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  ) {
    const mb = breakdown({ kind: "month", anchor: m })
    months.push([
      format(m, "MMMM"),
      kwh(mb.grid),
      kwh(mb.genKwh),
      kwh(mb.total),
    ])
  }
  const dieselRef = b.genKwh / OPTIMAL_KWH_PER_L
  const body = [
    section(
      "Summary",
      table(
        ["", "Energy", "Estimated cost"],
        [
          ["Grid (utility)", kwh(b.grid), naira(b.grid * TARIFF)],
          ["Generators", kwh(b.genKwh), naira(dieselRef * DIESEL_PRICE)],
          ...(b.solar ? [["Solar", kwh(b.solar), naira(0)]] : []),
          [
            "<strong>Total</strong>",
            `<strong>${kwh(b.total)}</strong>`,
            `<strong>${naira(b.grid * TARIFF + dieselRef * DIESEL_PRICE)}</strong>`,
          ],
        ]
      )
    ),
    section(
      "By month",
      table(["Month", "Grid", "Generators", "Total"], months)
    ),
    section(
      "Calculated diesel reference",
      `<p style="margin:0;font-size:13px">About <strong>${Math.round(dieselRef).toLocaleString("en-NG")} L</strong> of diesel at ${OPTIMAL_KWH_PER_L} kWh/L for the period.</p>`
    ),
  ].join("")
  return emailShell(
    `Periodic energy report · ${currentBranch().name}`,
    `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`,
    body,
    end.getFullYear()
  )
}

export function demoPreviewHtml(request: ReportRequest) {
  let html: string
  // The UI only previews daily and periodic (a calendar year); monthly is rendered in-app.
  if (request.report_type === "daily") html = dailyEmail(parseISO(request.date))
  else if (request.report_type === "periodic")
    html = periodicEmail({ kind: "year", anchor: parseISO(request.start_date) })
  else html = periodicEmail(monthPeriod(request.month, request.year))
  return wait<PreviewReportResponse>({ html_email: html })
}
