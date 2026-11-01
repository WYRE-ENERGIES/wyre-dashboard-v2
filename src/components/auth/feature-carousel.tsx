"use client"

import * as React from "react"
import {
  BellRingIcon,
  FuelIcon,
  GaugeIcon,
  ReceiptTextIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

type Feature = { icon: LucideIcon; title: string; body: string }

const FEATURES: Feature[] = [
  {
    icon: ZapIcon,
    title: "Know where every kilowatt goes.",
    body: "Track energy across your branches — utility, generators and solar — by the hour, day or month, in one place.",
  },
  {
    icon: FuelIcon,
    title: "Catch diesel waste early.",
    body: "Compare the fuel your generators really burned with what was reported, and see run hours and efficiency per generator.",
  },
  {
    icon: GaugeIcon,
    title: "Score how efficiently you run.",
    body: "Baseline savings, peak-to-average demand, generator sizing and carbon — rolled into one Score Card.",
  },
  {
    icon: ReceiptTextIcon,
    title: "Track every naira.",
    body: "Log utility, IPP and diesel spend, follow your blended cost per kWh, and get daily and monthly reports by email.",
  },
  {
    icon: BellRingIcon,
    title: "Hear about problems first.",
    body: "Set alerts for voltage, power factor, load imbalance and generators running outside operating hours.",
  },
]

/** How long each slide stays up. The navigator bar fills over this time. */
const SLIDE_MS = 6000

/**
 * Auto-rotating feature slides for the sign-in brand panel. The yellow bars
 * are the navigator: the active one fills up as its slide plays, and any bar
 * can be clicked to jump. Pauses while hovered; no auto-rotation when the
 * user prefers reduced motion.
 */
export function FeatureCarousel() {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const feature = FEATURES[index]
  const next = () => setIndex((i) => (i + 1) % FEATURES.length)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What Wyre does"
      className="max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fixed height so the panel doesn't jump between slides. */}
      <div className="min-h-56" aria-live={reducedMotion || paused ? "polite" : "off"}>
        <div
          key={index}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${FEATURES.length}`}
          className="animate-in duration-500 fade-in slide-in-from-bottom-3 motion-reduce:animate-none"
        >
          <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-highlight/20 text-highlight">
            <feature.icon className="size-5" />
          </span>
          <p className="font-heading text-3xl leading-tight font-semibold">{feature.title}</p>
          <p className="mt-3 text-primary-foreground/75">{feature.body}</p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2">
        {FEATURES.map((f, i) => {
          const active = i === index
          return (
            <button
              key={f.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}: ${f.title}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "group relative h-1 overflow-hidden rounded-full transition-[width,background-color] duration-300 outline-none",
                "before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']", // larger hit area
                "focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-4 focus-visible:ring-offset-primary",
                active ? "w-16 bg-primary-foreground/25" : "w-6 bg-primary-foreground/25 hover:bg-primary-foreground/45"
              )}
            >
              {active && (
                <span
                  key={index}
                  aria-hidden
                  onAnimationEnd={next}
                  className="absolute inset-y-0 left-0 rounded-full bg-highlight"
                  style={
                    reducedMotion
                      ? { width: "100%" }
                      : {
                          animation: `wyre-progress ${SLIDE_MS}ms linear forwards`,
                          animationPlayState: paused ? "paused" : "running",
                        }
                  }
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}
