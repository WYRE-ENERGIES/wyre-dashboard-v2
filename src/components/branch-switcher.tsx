"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { BuildingIcon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { toast } from "sonner"

import { RAIL_BUTTON } from "@/components/app-sidebar-styles"
import { useClaims, useSession } from "@/components/session-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { getPermittedBranches, getSideBar } from "@/lib/api/endpoints"
import { cn } from "@/lib/utils"

/** Branch selection. Mirrors today's mechanism: switching asks the backend
 * for that branch's token (`POST force-login/{id}/`). */
export function BranchSwitcher() {
  const claims = useClaims()
  const { switchBranch } = useSession()
  const [switching, setSwitching] = React.useState(false)

  const sideBar = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const permitted = useQuery({ queryKey: ["permitted-branches"], queryFn: getPermittedBranches })

  const currentName =
    sideBar.data?.authenticatedData.branches[0]?.name ??
    permitted.data?.branches.find((b) => b.id === claims.branch_id)?.name ??
    "Loading branch…"
  const branches = [...(permitted.data?.branches ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const canSwitch = branches.length > 1

  async function onSelect(branchId: number, name: string) {
    if (branchId === claims.branch_id) return
    setSwitching(true)
    try {
      await switchBranch(branchId)
      toast.success(`Switched to ${name}`)
    } catch {
      toast.error(`Couldn't switch to ${name}. Try again.`)
    } finally {
      setSwitching(false)
    }
  }

  const button = (
    <SidebarMenuButton
      size="lg"
      tooltip={currentName}
      className={cn("data-popup-open:bg-sidebar-accent", RAIL_BUTTON)}
    >
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {switching ? <Spinner /> : <BuildingIcon className="size-4" />}
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{currentName}</span>
        <span className="truncate text-xs text-muted-foreground">{claims.client}</span>
      </div>
      {canSwitch && <ChevronsUpDownIcon className="ml-auto" />}
    </SidebarMenuButton>
  )

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        {canSwitch ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={button} disabled={switching} />
            <DropdownMenuContent align="start" className="min-w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
                {branches.map((branch) => (
                  <DropdownMenuItem
                    key={branch.id}
                    onClick={() => onSelect(branch.id, branch.name)}
                  >
                    <span className="truncate">{branch.name}</span>
                    {branch.id === claims.branch_id && <CheckIcon className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          button
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
