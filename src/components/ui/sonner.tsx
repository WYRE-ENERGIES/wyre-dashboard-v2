"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// App-wide toast defaults: top-right, closable, coloured by type
// (success / error / warning / info), with a title and optional description.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      // Desktop: just below the sticky filter bar so toasts don't cover it.
      offset={{ top: 72, right: 16 }}
      mobileOffset={{ top: 16, right: 16, left: 16 }}
      richColors
      closeButton
      duration={4000}
      visibleToasts={4}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-lg",
          // Close button in the top-right corner (Sonner defaults to top-left).
          closeButton: "left-auto! right-0! [transform:translate(35%,-35%)]!",
          title: "font-medium",
          description: "opacity-80",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
