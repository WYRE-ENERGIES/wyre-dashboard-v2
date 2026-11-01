import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The Wyre (Django) backend distinguishes `/path` from `/path/`, so the
  // proxy in app/api must receive URLs exactly as the client sent them.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
