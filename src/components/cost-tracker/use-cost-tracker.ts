"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useClaims } from "@/components/session-provider"
import {
  getBaseline,
  getBranchOverview,
  getDailyDieselUsage,
  getDieselOverview,
  getEquipments,
  getGenerators,
  getIppOverview,
  getMonthlyDieselUsage,
  getUtilityOverview,
} from "@/lib/api/cost-tracker"
import { flattenGenerators } from "@/lib/cost-tracker/rules"

/**
 * Every cost-tracker query key starts with "cost-tracker" so a write can
 * refresh them all (the old page never refreshed after an edit or delete).
 *
 * The endpoints take no date range, so keys hold the branch only: changing
 * the global period re-filters the cached rows on the client instead of
 * refetching the same response.
 */
export const COST_TRACKER_KEY = "cost-tracker"

export function useCostTrackerQueries() {
  const { branch_id: branchId, client_type } = useClaims()
  const key = (name: string) => [COST_TRACKER_KEY, name, branchId] as const

  return {
    branchOverview: useQuery({
      queryKey: key("branch-overview"),
      queryFn: ({ signal }) => getBranchOverview(branchId, signal),
    }),
    dieselOverview: useQuery({
      queryKey: key("diesel-overview"),
      queryFn: ({ signal }) => getDieselOverview(branchId, signal),
    }),
    utilityOverview: useQuery({
      queryKey: key("utility-overview"),
      queryFn: ({ signal }) => getUtilityOverview(branchId, signal),
    }),
    ippOverview: useQuery({
      queryKey: key("ipp-overview"),
      queryFn: ({ signal }) => getIppOverview(branchId, signal),
      enabled: client_type === "RESELLER",
    }),
    baseline: useQuery({
      queryKey: key("baseline"),
      queryFn: ({ signal }) => getBaseline(branchId, signal),
    }),
  }
}

export function useGenerators() {
  const { branch_id: branchId } = useClaims()
  return useQuery({
    queryKey: [COST_TRACKER_KEY, "generators", branchId],
    queryFn: ({ signal }) => getGenerators(branchId, signal),
    select: flattenGenerators,
    staleTime: 10 * 60_000,
  })
}

export function useDieselEntries() {
  const { branch_id: branchId } = useClaims()
  return {
    daily: useQuery({
      queryKey: [COST_TRACKER_KEY, "diesel-daily-usage", branchId],
      queryFn: ({ signal }) => getDailyDieselUsage(branchId, signal),
    }),
    monthly: useQuery({
      queryKey: [COST_TRACKER_KEY, "diesel-monthly-usage", branchId],
      queryFn: ({ signal }) => getMonthlyDieselUsage(branchId, signal),
    }),
  }
}

export function useEquipments() {
  const { user_id: userId } = useClaims()
  return useQuery({
    queryKey: [COST_TRACKER_KEY, "equipments", userId],
    queryFn: ({ signal }) => getEquipments(userId, signal),
  })
}

/**
 * A write with the standard follow-up: success toast and refresh every
 * cost-tracker query, or an error toast with the backend's message.
 */
export function useCostMutation<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  messages: { success: string; error: string }
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success(messages.success)
      return queryClient.invalidateQueries({ queryKey: [COST_TRACKER_KEY] })
    },
    onError: (error) => {
      toast.error(messages.error, {
        description: error.message || "Please try again.",
      })
    },
  })
}
