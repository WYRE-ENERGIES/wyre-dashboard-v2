import { FeatureCarousel } from "@/components/auth/feature-carousel"
import { WyreLogo } from "@/components/wyre-logo"

/** Shared frame for sign-in and password pages: brand panel on wide screens,
 * the form on the right (or alone on phones). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
        <WyreLogo className="h-9 self-start text-primary-foreground" />
        <div className="relative z-10 mt-auto">
          <FeatureCarousel />
        </div>
        {/* Soft brand shapes */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary-foreground/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 right-16 size-24 rounded-full bg-highlight/15"
        />
      </aside>
      <main className="flex flex-col items-center justify-center gap-8 p-6 sm:p-10">
        <WyreLogo className="h-9 text-primary lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Wyre. All rights reserved.</p>
      </main>
    </div>
  )
}
