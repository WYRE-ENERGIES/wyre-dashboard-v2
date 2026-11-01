import { forwardToBackend } from "@/lib/proxy"

// The token refresh endpoint lives outside /api/v1 on the backend:
// /api/token/refresh/ → {BACKEND_URL}/token/refresh/
export const POST = (request: Request) => forwardToBackend(request, "/api")
