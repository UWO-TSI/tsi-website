"use client";

/**
 * The club monument's E (d-monument, specs/launch/v1-gameplay.md): the club goal being built there, how far the club
 * has come, your share, and Contribute, the same goal and flow as the notice board (ClubGoal, ContributeSheet).
 */
import { useState } from "react";
import { Flag, Landmark } from "lucide-react";
import { useProgression } from "@/lib/progression/useProgression";
import { onBoard } from "@/lib/progression/seasonal";
import { Empty } from "@/components/gui";
import ClubGoal, { isUpNext } from "./ClubGoal";
import ContributeSheet from "./ContributeSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";

export default function MonumentSheet({ open, onClose, keys }: ProgressionSheetProps & { keys?: string }) {
  const { state } = useProgression();
  const [contributeSlug, setContributeSlug] = useState<string | null>(null);
  const goals = state.goals.filter((g) => onBoard(g) && !isUpNext(g));
  return (
    <ProgressionPanel flat open={open} onClose={onClose} title="Club monument" keys={keys} icon={<Landmark size={20} />}>
      {goals.length ? goals.map((g) => <ClubGoal key={g.slug} goal={g} look="notice" onContribute={setContributeSlug} />)
        : <Empty icon={<Flag size={32} />} title="No club goal right now">The next one goes up on the notice board.</Empty>}
      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </ProgressionPanel>
  );
}
