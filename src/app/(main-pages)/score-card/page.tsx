import type { Metadata } from "next"

import { ScoreCardView } from "@/components/score-card/score-card-view"

export const metadata: Metadata = { title: "Score Card" }

export default function ScoreCardPage() {
  return <ScoreCardView />
}
