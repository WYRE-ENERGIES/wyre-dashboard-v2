import { FeatureCarousel } from "@/components/auth/feature-carousel"
import { WyreLogo } from "@/components/wyre-logo"

/** Shared frame for sign-in and password pages: brand panel on wide screens,
 * the form on the right (or alone on phones). */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand p-10 text-brand-foreground lg:flex lg:flex-col">
        <WyreLogo className="relative z-10 h-9 self-start text-brand-foreground" />
        <div className="relative z-10 mt-auto">
          <FeatureCarousel />
        </div>
        {/* Soft waves, as on the report emails' header */}
        <svg
          aria-hidden
          viewBox="0 0 600 800"
          preserveAspectRatio="xMaxYMin slice"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <path
            d="M600 0H330C420 150 300 300 420 430C520 540 600 520 600 520Z"
            className="fill-brand-foreground/6"
          />
          <path
            d="M600 0H470C520 120 440 260 520 360C560 410 600 400 600 400Z"
            className="fill-brand-foreground/8"
          />
          <path
            d="M0 800V640C140 600 240 700 380 660C470 634 540 600 600 610V800Z"
            className="fill-highlight/10"
          />
        </svg>
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 p-6 sm:p-10">
        <WyreLogo className="h-9 text-brand lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Wyre. All rights reserved.
        </p>
      </main>
    </div>
  )
}
