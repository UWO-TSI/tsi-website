"use client";

/**
 * The club monument's E (d-monument; David 2026-10-28: "less words, more icon and visual and more juicy and simple to
 * understand just by looking at it"): the club goal as a picture on its paper notice, how far the club has come as a
 * filling bar whose marks are the monument's build stages, the club's members and your share as icons and counting
 * numbers, what to bring as the real items (a line of words on hover), what everyone gets, and Contribute. The same
 * goal and flow as the notice board (ContributeSheet).
 */
import { useState } from "react";
import { Flag, Gift, Landmark, User, Users } from "lucide-react";
import { useProgression } from "@/lib/progression/useProgression";
import { onBoard } from "@/lib/progression/seasonal";
import type { DeliveryKind, GoalProgressView } from "@/lib/progression/types";
import { iconUrl } from "@/lib/icons/keys";
import { Card, Empty } from "@/components/gui";
import { CountUp, DarkButton, GoalMeter } from "@/components/gui/flat";
import { isUpNext } from "./ClubGoal";
import { rewardName } from "./GoalCard";
import ContributeSheet from "./ContributeSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import s from "./monument.module.css";

/** Each goal's picture (a rendered icon of what it builds); the monument's banner for the rest. */
const GOAL_PICTURE: Record<string, string> = { "reopen-cafe": "lounge-tea", "fund-museum": "wall-frame" };
/** What a delivery kind is, as a real item, and its words on hover. */
const BRING: Record<DeliveryKind, { icon: string; words: string }> = {
  coins: { icon: "coin", words: "Coins" },
  material: { icon: "apple", words: "Fruit and flowers" },
  specimen: { icon: "fish_dace", words: "Fish and bugs" },
};
/** The monument's four build stages, the bar's quarter marks (ClubMonument: the scaffold and its materials, the stone, the banners, the lanterns). */
const STAGES = ["wood_branch", "rock_stone", "monument-banner", "stone-lantern"];

// eslint-disable-next-line @next/next/no-img-element -- item icons are small static webps
const Pic = ({ k, size }: { k: string; size?: number }) => <img src={iconUrl(k)} alt="" width={size} height={size} />;

function Goal({ goal, onContribute }: { goal: GoalProgressView; onContribute: (slug: string) => void }) {
  const myRoom = Math.max(0, goal.caps.member_total - goal.my_points);
  const rewards = goal.event.rewards.map(rewardName);
  return <article className={s.goal} aria-label={goal.title} data-testid="monument-goal">
    <Card as="div" pinned tilt={-0.6} className={s.notice} data-gui-paper="">
      <span className={s.picture}><Pic k={GOAL_PICTURE[goal.slug] ?? "monument-banner"} size={96} /></span>
      <h3 className={s.title}>{goal.title}</h3>
    </Card>
    <GoalMeter value={goal.percent / 100} label={`${goal.title}: ${goal.percent}%`} marks={STAGES.map(k => <Pic key={k} k={k} />)} />
    <p className={s.points}><CountUp value={goal.points} rise /><span className={s.of}>/ {goal.target_points.toLocaleString()}</span></p>
    <div className={s.row}>
      <span className={s.stat} title="Members who chipped in"><Users size={20} aria-label="Members" /><CountUp value={goal.contributors} rise /></span>
      <span className={s.stat} data-mine="" title="Your share, in points"><User size={20} aria-label="Your share" /><CountUp value={goal.my_points} rise /></span>
    </div>
    <div className={s.row}>
      {goal.accepts.map(k => <span key={k} className={s.bring} title={`${BRING[k].words}: ${goal.weights[k]} ${goal.weights[k] === 1 ? "point" : "points"} each`} aria-label={BRING[k].words}><Pic k={BRING[k].icon} size={34} /></span>)}
      {rewards.length > 0 && <span className={s.bring} data-reward="" title={`When it fills, everyone gets ${rewards.join(", ")}`} aria-label={`Reward: ${rewards.join(", ")}`}><Gift size={26} strokeWidth={1.8} /></span>}
    </div>
    {!goal.completed && goal.open && <DarkButton className={s.give} onClick={() => onContribute(goal.slug)} disabled={myRoom <= 0}>{myRoom <= 0 ? "Your share is full" : "Contribute"}</DarkButton>}
  </article>;
}

export default function MonumentSheet({ open, onClose, keys }: ProgressionSheetProps & { keys?: string }) {
  const { state } = useProgression();
  const [contributeSlug, setContributeSlug] = useState<string | null>(null);
  const goals = state.goals.filter((g) => onBoard(g) && !isUpNext(g));
  return (
    <ProgressionPanel flat open={open} onClose={onClose} title="Club monument" keys={keys} icon={<Landmark size={20} />}>
      {goals.length ? goals.map((g) => <Goal key={g.slug} goal={g} onContribute={setContributeSlug} />)
        : <Empty icon={<Flag size={32} />} title="No club goal right now">The next one goes up on the notice board.</Empty>}
      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </ProgressionPanel>
  );
}
