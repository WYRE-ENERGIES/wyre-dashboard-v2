import { BACKEND_URL } from "@/lib/backend"

const FORWARDED_REQUEST_HEADERS = ["authorization", "content-type", "accept"]
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition"]

/**
 * Forwards a request to the Wyre backend unchanged (path, query, trailing
 * slash, method, body, auth header) and streams the response back.
 *
 * `stripPrefix` is the part of the incoming path that is ours, not the
 * backend's (e.g. "/api" turns "/api/v1/side_bar_data" into "/v1/…").
 */
export async function forwardToBackend(request: Request, stripPrefix: string) {
  const incoming = new URL(request.url)
  // Use the raw (still percent-encoded) path so date segments such as
  // "14-07-2026%2000:00" reach the backend exactly as sent.
  const rawPath = request.url.slice(incoming.origin.length).split("?")[0]
  const backendPath = rawPath.startsWith(stripPrefix)
    ? rawPath.slice(stripPrefix.length)
    : rawPath
  const target = `${BACKEND_URL}${backendPath}${incoming.search}`

  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const hasBody = !["GET", "HEAD"].includes(request.method)
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
    // Django's APPEND_SLASH answers some GETs with a 301 to the same path
    // plus "/". Follow it here (same host, so the auth header is kept); the
    // browser couldn't, since only a few response headers are passed on.
    redirect: hasBody ? "manual" : "follow",
  })

  const responseHeaders = new Headers()
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
