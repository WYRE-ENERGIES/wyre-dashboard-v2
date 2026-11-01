import { jwtDecode } from "jwt-decode"

/** Tokens as issued by `POST /api/v1/auth/` and `POST force-login/{id}/`. */
export type SessionTokens = { access: string; refresh: string }

/** Claims the app relies on (see inventory 00-live-walkthrough, "JWT claims"). */
export type UserClaims = {
  exp: number
  user_id: number
  id: number
  first_name?: string
  last_name?: string
  email?: string
  username: string
  phone_number?: string
  client: string
  client_type: "STANDARD" | "RESELLER" | "BESPOKE" | string
  client_id: number
  client_image?: string
  role?: number | string
  role_text?: "OPERATOR" | string
  branch_id: number
  details?: string
  has_ems?: boolean
  has_solar?: boolean
  /** Legacy fallback used before has_ems / has_solar existed. */
  is_solar_customer?: boolean
}

// Mirrors today's model (decision #6): tokens live in the browser and are sent
// as a bearer header. Kept behind this module so cookies can replace it later.
const STORAGE_KEY = "wyre.session"

export function readTokens(): SessionTokens | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionTokens>
    return parsed.access && parsed.refresh
      ? { access: parsed.access, refresh: parsed.refresh }
      : null
  } catch {
    return null
  }
}

export function writeTokens(tokens: SessionTokens) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event("wyre:session"))
}

export function clearTokens() {
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event("wyre:session"))
}

export function decodeClaims(access: string): UserClaims | null {
  try {
    return jwtDecode<UserClaims>(access)
  } catch {
    return null
  }
}

/** True when the access token expires within `leewaySeconds` (or already has).
 * Note the old app checked 30 s *after* expiry; this checks before. */
export function isExpiringSoon(access: string, leewaySeconds = 60) {
  const claims = decodeClaims(access)
  if (!claims?.exp) return true
  return claims.exp * 1000 - leewaySeconds * 1000 <= Date.now()
}
