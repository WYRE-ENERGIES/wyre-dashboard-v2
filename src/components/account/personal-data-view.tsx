"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { KeyRoundIcon } from "lucide-react"

import { useClaims } from "@/components/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSideBar } from "@/lib/api/endpoints"
import { MEDIA_URL } from "@/lib/backend"
import { getProductAccess } from "@/lib/gating"

/** Old formatLabel (PersonalData.js:12-17): true → Yes, false → No, empty → —. */
function display(value: unknown) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

const titleCase = (value?: string) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase() : value

/**
 * Read-only profile from the token claims (production PersonalData.js:42-62).
 * Organisation and branch names come from side_bar_data, which the shell
 * already loads; the old page needed the global org call and was empty on a
 * direct load.
 */
export function PersonalDataView() {
  const claims = useClaims()
  const { hasEms, hasSolar } = getProductAccess(claims)
  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const org = sideBar.data?.authenticatedData
  const branch =
    org?.branches.find(
      (b) => b.branch_id === claims.branch_id || b.id === claims.branch_id
    ) ?? org?.branches[0]

  const name =
    [claims.first_name, claims.last_name].filter(Boolean).join(" ") ||
    claims.username
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const image = org?.image ?? claims.client_image
  const imageSrc = image
    ? /^https?:\/\//.test(image)
      ? image
      : `${MEDIA_URL}${image.startsWith("/") ? "" : "/"}${image}`
    : undefined

  const loadingName = sideBar.isPending ? (
    <Skeleton className="h-4 w-32" />
  ) : undefined

  return (
    <>
      <PageHeader
        title="Personal Data"
        description="Your account details. Contact your Wyre administrator to change them."
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/password" />}
          >
            <KeyRoundIcon />
            Change password
          </Button>
        }
      />
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16 rounded-2xl after:rounded-2xl">
            {imageSrc && (
              <AvatarImage
                src={imageSrc}
                alt=""
                className="rounded-2xl bg-background object-contain p-1"
              />
            )}
            <AvatarFallback className="rounded-2xl text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-heading text-xl font-semibold">
              {name}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{org?.name ?? claims.client}</span>
              {claims.role_text && (
                <Badge variant="secondary">{titleCase(claims.role_text)}</Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Account"
          rows={[
            { label: "Username", value: claims.username },
            { label: "Email", value: claims.email },
            { label: "Role", value: titleCase(claims.role_text) },
            { label: "Energy monitoring (EMS)", value: hasEms },
            { label: "Solar", value: hasSolar },
          ]}
        />
        <Section
          title="Organisation"
          rows={[
            { label: "Organisation", value: org?.name, loading: loadingName },
            { label: "Client", value: claims.client },
            { label: "Client type", value: titleCase(claims.client_type) },
            { label: "Branch", value: branch?.name, loading: loadingName },
            { label: "About", value: claims.details },
          ]}
        />
      </div>
    </>
  )
}

function Section({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: unknown; loading?: React.ReactNode }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
            >
              <dt className="text-muted-foreground sm:w-48 sm:shrink-0">
                {row.label}
              </dt>
              <dd className="min-w-0 break-words">
                {row.loading ?? display(row.value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
