import { cn } from "@/lib/utils"

/**
 * The daily and periodic emails share one paper: the email's header banner,
 * a centred title, purple section rules, then the email's footer banner.
 */
export function EmailReport({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
      <header>
        <img
          src="/report/email-header.jpg"
          alt="Wyre"
          className="block h-auto w-full"
        />
      </header>
      <div className="flex flex-col gap-8 px-5 py-8 sm:px-10">
        <h2 className="text-center font-heading text-2xl font-semibold tracking-tight">
          <span className="border-b-2 border-brand pb-1">{title}</span>
        </h2>
        {children}
      </div>
      <footer>
        <img
          src="/report/email-footer.gif"
          alt="Wyre. Power to manage Energy and Carbon"
          className="block h-auto w-full"
        />
      </footer>
    </article>
  )
}

export function EmailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-center text-base font-semibold text-brand">
        <span className="border-b border-brand pb-0.5">{title}</span>
      </h3>
      {children}
    </section>
  )
}

export function EmailNote({
  tone,
  title,
  children,
}: {
  tone: "warning" | "savings" | "month"
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-4",
        tone === "warning" &&
          "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "savings" &&
          "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
        tone === "month" &&
          "bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100"
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
