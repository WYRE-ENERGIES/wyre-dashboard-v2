import { forwardToBackend } from "@/lib/proxy"

// Same-origin proxy for the Wyre API: /api/v1/* → {BACKEND_URL}/api/v1/*.
// Keeps the backend URL out of the client and avoids CORS.
const handler = (request: Request) => forwardToBackend(request, "")

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
}
