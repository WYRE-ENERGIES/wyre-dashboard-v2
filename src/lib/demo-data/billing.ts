import { format } from "date-fns"

import type {
  BillFrequency,
  BillingResponse,
  MailSchedules,
  MailSchedulesResponse,
} from "@/lib/api/billing-types"
import {
  base,
  currentBranch,
  daysOf,
  DEVICES,
  hourlyKwh,
  totals,
  wait,
} from "@/lib/demo"
import { periodEnd, periodLabel, shiftPeriod, type Period } from "@/lib/period"

/** Naira per kWh billed to tenants, per source (demo values). */
const TARIFF: Record<string, number> = {
  UTILITY: 225,
  GENERATOR: 310,
  SOLAR: 180,
}
const tariff = (deviceType: string) => TARIFF[deviceType] ?? 250

const round = (n: number) => Math.round(n * 100) / 100

/** Daily points for a month or year, hourly for a day (the old chart's
 * "DD/MM/YYYY h:mm A" labels suggest timestamps). */
function series(device: (typeof DEVICES)[number], period: Period) {
  const end = periodEnd(period).getTime()
  if (period.kind === "day") {
    const day = daysOf(period)[0]
    const hours = Array.from({ length: 24 }, (_, h) => h).filter(
      (h) => day.getTime() + h * 3_600_000 <= end
    )
    return {
      dates: hours.map((h) =>
        format(new Date(day.getTime() + h * 3_600_000), "yyyy-MM-dd'T'HH:00:00")
      ),
      kwh: hours.map((h) => hourlyKwh(device, day, h)),
    }
  }
  const days = daysOf(period)
  return {
    dates: days.map((d) => format(d, "yyyy-MM-dd'T'00:00:00")),
    kwh: days.map((d) =>
      round(
        Array.from({ length: 24 }, (_, h) =>
          d.getTime() + h * 3_600_000 > end ? 0 : hourlyKwh(device, d, h)
        ).reduce((a, b) => a + b, 0)
      )
    ),
  }
}

let schedules: MailSchedules = {
  external_recievers: [
    {
      id: 1,
      email: "accounts@tenant-one.example",
      assigned_devices: [
        { id: 101, name: "UTILITY" },
        { id: 102, name: "GEN_275kVA" },
      ],
    },
    { id: 2, email: "facilities@tenant-two.example", assigned_devices: [] },
  ],
  available_devices: DEVICES.map((d) => ({
    device_id: d.device_id,
    device_name: d.name,
  })),
  personal_data: {
    assigned_devices: [{ id: 101, name: "UTILITY" }],
    frequency: "MONTHLY",
  },
}
let nextReceiverId = 3

const respond = () =>
  wait<MailSchedulesResponse>({ data: structuredClone(schedules) })

export const demoBilling = {
  billing: (period: Period) => {
    const present = totals(period)
    const previous = totals(shiftPeriod(period, -1))
    const branch = currentBranch()
    const devices = DEVICES.map((device, i) => {
      const s = series(device, period)
      const rate = tariff(device.device_type)
      const prevKwh = previous[i].kwh
      return {
        ...base(device),
        billing: {
          consumption_kwh: { dates: s.dates, values: s.kwh },
          consumption_naira: {
            dates: s.dates,
            values: s.kwh.map((v) => round(v * rate)),
          },
          totals: {
            present_total: {
              usage_kwh: round(present[i].kwh),
              value_naira: round(present[i].kwh * rate),
            },
            previous_total: {
              usage_kwh: round(prevKwh),
              value_naira: round(prevKwh * rate),
            },
          },
        },
      }
    })
    const sum = (pick: (d: (typeof devices)[number]) => number) =>
      round(devices.reduce((a, d) => a + pick(d), 0))
    return wait<BillingResponse>({
      status: true,
      message: "Successful",
      authenticatedData: {
        name: "Demo Retail Ltd",
        branches: [
          {
            id: branch.id,
            branch_id: branch.id,
            name: branch.name,
            billing_totals: {
              present_total: {
                usage_kwh: sum((d) => d.billing.totals.present_total.usage_kwh),
                value_naira: sum(
                  (d) => d.billing.totals.present_total.value_naira
                ),
              },
              previous_total: {
                usage_kwh: sum(
                  (d) => d.billing.totals.previous_total.usage_kwh
                ),
                value_naira: sum(
                  (d) => d.billing.totals.previous_total.value_naira
                ),
              },
            },
            devices,
          },
        ],
      },
    })
  },

  schedules: respond,

  addReceiver: (email: string) => {
    schedules = {
      ...schedules,
      external_recievers: [
        ...(schedules.external_recievers ?? []),
        { id: nextReceiverId++, email, assigned_devices: [] },
      ],
    }
    return respond()
  },

  removeReceiver: (receiverId: number) => {
    schedules = {
      ...schedules,
      external_recievers: (schedules.external_recievers ?? []).filter(
        (r) => r.id !== receiverId
      ),
    }
    return respond()
  },

  assign: (body: {
    receiver_id?: number
    selected_devices: number[]
    frequency?: BillFrequency
  }) => {
    const devices = body.selected_devices.map((id) => ({
      id,
      name: DEVICES.find((d) => d.device_id === id)?.name ?? String(id),
    }))
    schedules =
      body.receiver_id !== undefined
        ? {
            ...schedules,
            external_recievers: (schedules.external_recievers ?? []).map((r) =>
              r.id === body.receiver_id
                ? { ...r, assigned_devices: devices }
                : r
            ),
          }
        : {
            ...schedules,
            personal_data: {
              assigned_devices: devices,
              frequency: body.frequency ?? schedules.personal_data?.frequency,
            },
          }
    return respond()
  },

  send: () => wait({ status: true, message: "Bill sent" }),

  /** A one-page sample bill, so the download works offline. */
  pdf: async (period: Period) => {
    const [{ jsPDF }, data] = await Promise.all([
      import("jspdf"),
      demoBilling.billing(period),
    ])
    const doc = new jsPDF()
    const branch = data.authenticatedData.branches[0]
    doc.setFontSize(18)
    doc.text("Wyre bill (demo)", 20, 24)
    doc.setFontSize(11)
    doc.text(`${branch.name} · ${periodLabel(period)}`, 20, 34)
    let y = 50
    for (const device of branch.devices) {
      const t = device.billing?.totals?.present_total
      doc.text(device.name.replace(/_/g, " "), 20, y)
      doc.text(`${(t?.usage_kwh ?? 0).toLocaleString("en-NG")} kWh`, 100, y)
      doc.text(`NGN ${(t?.value_naira ?? 0).toLocaleString("en-NG")}`, 150, y)
      y += 8
    }
    const total = branch.billing_totals?.present_total?.value_naira ?? 0
    doc.setFontSize(13)
    doc.text(`Total payable: NGN ${total.toLocaleString("en-NG")}`, 20, y + 8)
    return doc.output("blob")
  },
}
