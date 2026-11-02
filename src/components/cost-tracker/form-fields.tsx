"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type BaseProps<T extends FieldValues, O extends FieldValues> = {
  control: Control<T, unknown, O>
  name: FieldPath<T>
  label: string
  description?: React.ReactNode
  className?: string
}

/** A number typed as text (validated by the form's zod schema). */
export function NumberField<T extends FieldValues, O extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  placeholder,
  unit,
  integer = false,
  onValueChange,
}: BaseProps<T, O> & {
  placeholder?: string
  unit?: string
  integer?: boolean
  /** Runs after the field changes (tariff auto-calc). */
  onValueChange?: () => void
}) {
  const id = React.useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <div className="relative">
            <Input
              id={id}
              inputMode={integer ? "numeric" : "decimal"}
              autoComplete="off"
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
              className={cn("tabular-nums", unit && "pr-12")}
              name={field.name}
              ref={field.ref}
              value={(field.value as string | undefined) ?? ""}
              onBlur={field.onBlur}
              onChange={(event) => {
                field.onChange(event.target.value)
                onValueChange?.()
              }}
            />
            {unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {unit}
              </span>
            )}
          </div>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function TextField<T extends FieldValues, O extends FieldValues>({
  control,
  name,
  label,
  className,
  placeholder,
}: BaseProps<T, O> & { placeholder?: string }) {
  const id = React.useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
            {...field}
            value={(field.value as string | undefined) ?? ""}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** A computed value shown like a disabled input (tariff, amount). */
export function ReadOnlyField({
  label,
  value,
  description,
  className,
}: {
  label: string
  value: string
  description?: string
  className?: string
}) {
  const id = React.useId()
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        readOnly
        tabIndex={-1}
        className="bg-muted/60 tabular-nums"
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

export function DateField<T extends FieldValues, O extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disableFuture = true,
  optional = false,
  onPicked,
}: BaseProps<T, O> & {
  disableFuture?: boolean
  optional?: boolean
  /** Runs after a date is picked (e.g. default the end date). */
  onPicked?: (date: Date | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as Date | undefined
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <FieldLabel htmlFor={id}>
              {label}
              {optional && (
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              )}
            </FieldLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id={id}
                    ref={field.ref}
                    variant="outline"
                    aria-invalid={fieldState.invalid}
                    onBlur={field.onBlur}
                    className={cn(
                      "w-full justify-start font-normal",
                      !value && "text-muted-foreground"
                    )}
                  />
                }
              >
                <CalendarIcon />
                {value ? format(value, "d MMM yyyy") : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value}
                  defaultMonth={value}
                  disabled={disableFuture ? { after: new Date() } : undefined}
                  onSelect={(date) => {
                    field.onChange(date)
                    onPicked?.(date)
                    setOpen(false)
                  }}
                />
                {optional && value && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        field.onChange(undefined)
                        setOpen(false)
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {description && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

export function SelectField<T extends FieldValues, O extends FieldValues>({
  control,
  name,
  label,
  className,
  options,
  placeholder = "Select…",
  optional = false,
  disabled = false,
}: BaseProps<T, O> & {
  options: Array<{ value: string; label: string }>
  placeholder?: string
  optional?: boolean
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional && (
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            )}
          </FieldLabel>
          <Select
            items={options}
            value={(field.value as string | undefined) ?? null}
            onValueChange={(value) => field.onChange(value ?? undefined)}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              ref={field.ref}
              className="w-full"
              aria-invalid={fieldState.invalid}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

/** Fuel type is diesel only (old forms offered a one-option select). */
export function FuelTypeField() {
  return <ReadOnlyField label="Fuel type" value="Diesel" />
}
