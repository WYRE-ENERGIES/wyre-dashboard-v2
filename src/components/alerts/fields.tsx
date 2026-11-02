"use client"

import * as React from "react"
import { Controller, useFormContext, type FieldPath } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { AlertsFormValues } from "@/lib/alerts/form"
import { cn } from "@/lib/utils"

type BooleanField = {
  [K in keyof AlertsFormValues]: AlertsFormValues[K] extends boolean ? K : never
}[keyof AlertsFormValues]

type TextField = {
  [K in keyof AlertsFormValues]: AlertsFormValues[K] extends string ? K : never
}[keyof AlertsFormValues]

/** One alert: title and explanation on the left, its on/off switch on the
 * right, threshold inputs (children) underneath. */
export function AlertRow({
  name,
  title,
  description,
  children,
  badge,
}: {
  /** The switch's field; omit for info-only rows. */
  name?: BooleanField
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  /** Shown instead of a switch on info-only rows. */
  badge?: string
}) {
  const id = React.useId()
  const { control } = useFormContext<AlertsFormValues>()
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor={name ? id : undefined}
            className="text-sm font-medium"
          >
            {title}
          </label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {name ? (
          <Controller
            control={control}
            name={name}
            render={({ field }) => (
              <Switch
                id={id}
                className="mt-0.5"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
                onBlur={field.onBlur}
              />
            )}
          />
        ) : (
          badge && (
            <Badge variant="secondary" className="shrink-0">
              {badge}
            </Badge>
          )
        )}
      </div>
      {children}
    </div>
  )
}

/** A threshold input with its unit, e.g. "[ 250 ] V". Text, so decimals type
 * naturally; validation happens in the zod schema. */
export function ThresholdInput({
  name,
  label,
  unit,
  placeholder,
  className,
}: {
  name: TextField
  label: string
  unit?: string
  placeholder?: string
  className?: string
}) {
  const id = React.useId()
  const {
    register,
    formState: { errors },
  } = useFormContext<AlertsFormValues>()
  const error = errors[
    name as FieldPath<AlertsFormValues> & keyof typeof errors
  ]?.message as string | undefined
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-28 tabular-nums"
          {...register(name)}
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Inputs under a row, side by side when there is room. */
export function ThresholdGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-3">{children}</div>
}

/** A short note under a row (fixed send times etc.). */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  )
}
