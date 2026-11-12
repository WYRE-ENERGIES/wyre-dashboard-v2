import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // React's development double-mount runs every request twice (the first
  // copy cancelled), which with the slow backend crowds the browser's six
  // connections. Off while developing against the live API; set to true to
  // turn it back on. Production builds never double-mount either way.
  reactStrictMode: false,
  // The Wyre (Django) backend distinguishes `/path` from `/path/`, so the
  // proxy in app/api must receive URLs exactly as the client sent them.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
