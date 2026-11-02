"use client"

import { useQuery } from "@tanstack/react-query"

import { useFilters } from "@/components/filters-provider"
import { useClaims } from "@/components/session-provider"
import { getScoreCard } from "@/lib/api/score-card"
import type { ScoreCardMetric } from "@/lib/api/score-card-types"
import { serializePeriod } from "@/lib/period"

/** One query per score-card endpoint, so each card loads and fails on its
 * own. The old page fired all six twice on mount (12 requests); here each
 * fires once per branch + period. The device filter is applied client-side,
 * so ticking devices doesn't refetch. */
export function useScoreCardQuery(metric: ScoreCardMetric) {
  const { branch_id: branchId } = useClaims()
  const { period } = useFilters()
  const { view, date } = serializePeriod(period)
  return useQuery({
    queryKey: ["score-card", metric, branchId, view, date],
    queryFn: ({ signal }) => getScoreCard(metric, branchId, period, signal),
  })
}
