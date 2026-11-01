"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon, CpuIcon } from "lucide-react"

import { useFilters } from "@/components/filters-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSideBar } from "@/lib/api/endpoints"
import { formatDeviceName } from "@/lib/format"

/** The old sidebar's device checkboxes, as a global filter. No selection
 * means all devices of the current branch. */
export function DeviceFilter() {
  const { selectedDeviceIds, setSelectedDeviceIds } = useFilters()
  const { data } = useQuery({ queryKey: ["side-bar"], queryFn: getSideBar })
  const devices = data?.authenticatedData.branches[0]?.devices ?? []

  const label =
    selectedDeviceIds.length === 0
      ? "All devices"
      : selectedDeviceIds.length === 1
        ? formatDeviceName(devices.find((d) => d.device_id === selectedDeviceIds[0])?.name ?? "1 device")
        : `${selectedDeviceIds.length} devices`

  const toggle = (id: number, checked: boolean) => {
    const next = checked ? [...selectedDeviceIds, id] : selectedDeviceIds.filter((x) => x !== id)
    // Ticking every device is the same as "all".
    setSelectedDeviceIds(next.length === devices.length ? [] : next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={!devices.length}>
            <CpuIcon />
            {label}
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Devices</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setSelectedDeviceIds([])}>All devices</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {devices.map((device) => (
            <DropdownMenuCheckboxItem
              key={device.device_id}
              checked={selectedDeviceIds.includes(device.device_id)}
              onCheckedChange={(checked: boolean) => toggle(device.device_id, checked)}
              closeOnClick={false}
            >
              {formatDeviceName(device.name)}
              <span className="ml-auto pl-4 text-xs text-muted-foreground">
                {device.is_source ? "Source" : "Load"}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
