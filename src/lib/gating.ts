import type { UserClaims } from "@/lib/auth/session"

/**
 * Every feature-visibility rule lives here (inventory decision #3: keep
 * today's gating for now, in one place, so backend flags can replace it).
 */

export function getProductAccess(claims: UserClaims) {
  // Production (origin/dev helpers/authHelper.js getUserProductAccess):
  // explicit boolean has_ems / has_solar win; legacy tokens without them get
  // Solar, and EMS unless is_solar_customer marks them solar-only.
  if (
    typeof claims.has_ems === "boolean" ||
    typeof claims.has_solar === "boolean"
  ) {
    return {
      hasEms: Boolean(claims.has_ems),
      hasSolar: Boolean(claims.has_solar),
    }
  }
  const solarOnly = claims.is_solar_customer === true
  return { hasEms: !solarOnly, hasSolar: true }
}

export const isOperator = (claims: UserClaims) =>
  claims.role_text === "OPERATOR"

// Client names that unlock items for BESPOKE accounts (old helpers/constants.js).
const BESPOKE_ADD_LIST = {
  SCORE_CARD: ["Lennox Mall", "Sky View Beach", "Chicken Republic"],
  COST_TRACKER: ["Lennox Mall", "Chicken Republic"],
  REPORT: ["Lennox Mall", "Chicken Republic"],
  BILLING: [""],
} as const

type ClientModule = keyof typeof BESPOKE_ADD_LIST

function hasClientModule(claims: UserClaims, module: ClientModule) {
  switch (claims.client_type) {
    case "STANDARD":
      return module !== "BILLING"
    case "RESELLER":
      return module === "BILLING"
    case "BESPOKE":
      return (BESPOKE_ADD_LIST[module] as readonly string[]).includes(
        claims.client
      )
    default:
      return false
  }
}

export type NavKey =
  | "dashboard"
  | "load-overview"
  | "diesel"
  | "solar"
  | "parameters"
  | "score-card"
  | "cost-tracker"
  | "billing"
  | "report"
  | "alerts"
  | "breakers"

/** Which navigation items a user can see (old AppHeader.js). */
export function visibleNav(claims: UserClaims): Set<NavKey> {
  const { hasEms, hasSolar } = getProductAccess(claims)
  const items = new Set<NavKey>()
  if (hasEms) {
    // Load Overview was only reachable from the Dashboard in the old app;
    // it is in scope for the rebuild (inventory decision #4).
    items.add("dashboard").add("load-overview").add("diesel").add("parameters")
    if (hasClientModule(claims, "SCORE_CARD")) items.add("score-card")
    if (hasClientModule(claims, "COST_TRACKER")) items.add("cost-tracker")
    if (hasClientModule(claims, "REPORT")) items.add("report")
    if (hasClientModule(claims, "BILLING")) items.add("billing")
  }
  if (hasSolar) items.add("solar")
  // Breakers switch real equipment remotely: operators only.
  if (isOperator(claims)) items.add("alerts").add("breakers")
  return items
}

/** The "Solar hours" line on Total Energy is hidden for resellers. */
export const showsSolarHoursLine = (claims: UserClaims) =>
  claims.client_type !== "RESELLER"

/** The Load Overview block on the dashboard is a BESPOKE feature. */
export const showsDashboardLoadOverview = (claims: UserClaims) =>
  claims.client_type === "BESPOKE"
