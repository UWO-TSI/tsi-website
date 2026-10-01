"use client";

/**
 * The boarded-up café's E (cafe-polish §3): the chapter 2 club goal that
 * reopens it (the story goal unlocking "cafe"), its progress and the same
 * Contribute flow as the notice board.
 */
import { useState } from "react";
import { useProgression } from "@/lib/progression/useProgression";
import ContributeSheet from "@/components/progression/ContributeSheet";
import GoalCard from "@/components/progression/GoalCard";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import p from "@/components/progression/progression.module.css";

export default function CafeGoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useProgression();
  const goal = state.goals.find((g) => g.goal_type === "story" && g.unlocks.includes("cafe"));
  const [contribute, setContribute] = useState(false);
  return (
    <ProgressionPanel open={open} onClose={onClose} title="The old café">
      <p className={p.muted} style={{ marginTop: 0 }}>Boarded up for years. When the club fills this goal at the monument, the boards come off for everyone and the study tables inside open.</p>
      {goal ? <GoalCard goal={goal} onContribute={() => setContribute(true)} /> : <p className={p.muted}>The club goal isn&apos;t posted yet. Check the notice board.</p>}
      <ContributeSheet open={contribute} goalSlug={goal?.slug} onClose={() => setContribute(false)} />
    </ProgressionPanel>
  );
}
