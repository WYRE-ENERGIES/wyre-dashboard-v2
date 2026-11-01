/** Base URL of the Wyre backend. Server-side only: the browser talks to the
 * same-origin proxy under /api (see app/api). */
export const BACKEND_URL = (
  process.env.WYRE_BACKEND_URL ?? "https://backend.wyreng.com"
).replace(/\/$/, "")

/** Public host for media files (client logos etc.), which the API returns as
 * relative paths like `/media/images/logo.png`. */
export const MEDIA_URL = (
  process.env.NEXT_PUBLIC_WYRE_MEDIA_URL ?? "https://backend.wyreng.com"
).replace(/\/$/, "")
