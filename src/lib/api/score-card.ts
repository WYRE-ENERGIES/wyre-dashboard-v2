import { apiRequest } from "@/lib/api/client"
import type {
  ScoreCardMetric,
  ScoreCardResponse,
} from "@/lib/api/score-card-types"
import { DEMO } from "@/lib/demo"
import { demoScoreCard } from "@/lib/demo-data/score-card"
import { endpointRange, type Period } from "@/lib/period"

/**
 * GET scorecard/{metric}/{branchId}/{start}/{end}/ (inventory 06 §2.4).
 *
 * The old app sent these with `axios.get(url, {}, {headers})`, which drops
 * the Authorization header; these go through `apiRequest`, with auth. The
 * endpoints take no interval: the backend picks the chart resolution.
 */
export const getScoreCard = (
  metric: ScoreCardMetric,
  branchId: number,
  period: Period,
  signal?: AbortSignal
) =>
  DEMO
    ? demoScoreCard(metric, period)
    : apiRequest<ScoreCardResponse>(
        `scorecard/${metric}/${branchId}/${endpointRange(period)}/`,
        { signal }
      )
