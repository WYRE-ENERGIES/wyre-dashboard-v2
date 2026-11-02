import {
  clearTokens,
  isExpiringSoon,
  readTokens,
  writeTokens,
  type SessionTokens,
} from "@/lib/auth/session"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  /** Skip the bearer header and refresh logic (login, password reset…). */
  anonymous?: boolean
  signal?: AbortSignal
  /** "blob" for file downloads (PDFs); the default parses JSON. */
  responseType?: "json" | "blob"
  /** Accept header, e.g. "application/pdf" for downloads. */
  accept?: string
}

let refreshInFlight: Promise<SessionTokens | null> | null = null

/** Refreshes the access token once, however many requests ask at the same time.
 * The old app saved the *old* token back (typo + spread order); this keeps the
 * new one. */
function refreshTokens(tokens: SessionTokens) {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch("/api/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })
      if (!response.ok) return null
      const data = (await response.json()) as Partial<SessionTokens>
      if (!data.access) return null
      const next = { ...tokens, ...data } as SessionTokens
      writeTokens(next)
      return next
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function expireSession() {
  clearTokens()
  if (window.location.pathname !== "/login") {
    const from = encodeURIComponent(
      window.location.pathname + window.location.search
    )
    window.location.assign(`/login?from=${from}`)
  }
}

/**
 * Single client for every backend call. `path` is relative to /api/v1/ and is
 * sent exactly as given (keep the backend's trailing slashes).
 */
export async function apiRequest<T>(
  path: string,
  {
    method = "GET",
    body,
    anonymous = false,
    signal,
    responseType = "json",
    accept = "application/json",
  }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: accept }
  if (body !== undefined) headers["Content-Type"] = "application/json"

  if (!anonymous) {
    let tokens = readTokens()
    if (!tokens) {
      expireSession()
      throw new ApiError("Not signed in", 401, null)
    }
    if (isExpiringSoon(tokens.access)) {
      tokens = await refreshTokens(tokens)
      if (!tokens) {
        expireSession()
        throw new ApiError("Session expired", 401, null)
      }
    }
    headers.Authorization = `Bearer ${tokens.access}`
  }

  const response = await fetch(`/api/v1/${path.replace(/^\//, "")}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (responseType === "blob") {
    if (response.status === 401 && !anonymous) expireSession()
    if (!response.ok)
      throw new ApiError(
        `Request failed (${response.status})`,
        response.status,
        null
      )
    return (await response.blob()) as T
  }

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (response.status === 401 && !anonymous) {
    expireSession()
  }
  if (!response.ok) {
    const message =
      (data as { error?: string; message?: string } | null)?.error ??
      (data as { message?: string } | null)?.message ??
      `Request failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }
  return data as T
}
