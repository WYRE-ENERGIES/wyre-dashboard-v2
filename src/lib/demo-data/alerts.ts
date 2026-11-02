import type { AlertsResponse, AlertsSavePayload } from "@/lib/api/alerts-types"
import { wait } from "@/lib/demo"

/**
 * Demo alerts settings. Lekki (branch 1) has a battery, so its response
 * carries `battery_soc_config` and the page shows the battery SOC block;
 * the other branches don't. Saves are kept in memory for the session.
 */
function initial(branchId: number): AlertsResponse {
  const withBattery = branchId === 1
  return {
    data: {
      id: 100 + branchId,
      branch: branchId,
      daily_energy_usage_alerts: true,
      weekly_energy_usage_alerts: false,
      daily_energy_usage_days: "0,1,2,3,4",
      daily_battery_soc_alerts: withBattery,
      daily_unfavorable_weather_alerts: false,
      solar_capacity_utilization_alerts: true,
      solar_capacity_utilization_threshold_pct: 90,
      max_power_factor: 0.98,
      min_power_factor: 0.85,
      power_factor_alerts: true,
      load_balance_alerts: false,
      frequency_precision: 0.5,
      frequency_alerts: false,
      max_voltage: 250,
      min_voltage: 190,
      voltage_alerts: true,
      baseline_alerts: false,
      energy_usage_max: 12000,
      energy_usage_alerts: false,
      emitted_co2_alerts: false,
      set_co2_value: 5,
      set_co2_alerts: false,
      operating_time_alerts: true,
      load_threshold_value: 180,
      load_alerts: false,
      solar_power_demand_alerts: withBattery,
      voltage_alerted_at: null,
    },
    generator_data: [],
    battery_soc_config: withBattery
      ? {
          id: 7,
          branch_id: branchId,
          notification_type: "daily_battery_soc",
          is_enabled: true,
          push_enabled: true,
          email_enabled: true,
          schedule_times: [
            { id: 1, time: "07:00:00", days_of_week: "0,1,2,3,4,5,6" },
            { id: 2, time: "18:30:00", days_of_week: "0,1,2,3,4" },
          ],
          thresholds: [
            { id: 1, metric: "battery_soc", operator: "lte", value: 30 },
            { id: 2, metric: "battery_soc", operator: "gte", value: 95 },
          ],
        }
      : null,
  }
}

const saved = new Map<number, AlertsResponse>()

export const demoAlerts = {
  get: (branchId: number) =>
    wait<AlertsResponse>(
      structuredClone(saved.get(branchId) ?? initial(branchId))
    ),

  save: async (branchId: number, payload: AlertsSavePayload) => {
    await wait(null)
    const previous = saved.get(branchId) ?? initial(branchId)
    saved.set(branchId, {
      data: { ...previous.data, ...payload.data },
      generator_data: payload.generator_data,
      battery_soc_config: payload.battery_soc_config
        ? {
            ...previous.battery_soc_config,
            ...payload.battery_soc_config,
            schedule_times: payload.battery_soc_config.schedule_times.map(
              (t) => ({
                time: t.time,
                days_of_week: t.days_of_week ?? "0,1,2,3,4,5,6",
              })
            ),
          }
        : previous.battery_soc_config,
    })
    return { status: true, message: "Alerts updated" }
  },
}
