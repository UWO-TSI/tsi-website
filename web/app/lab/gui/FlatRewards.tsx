"use client";
/* eslint-disable @next/next/no-img-element -- a dev-only showroom of the real item icons */

/**
 * /lab/gui's flat reward pieces (components/gui/flat/rewards.tsx), in the base theme: hearts in halves (step them), the
 * welcome week's reward track (step the day), the prize wheel (spin it), the goal meter with its stage marks and a
 * counting number, and the quiet toast. `?only=flat-rewards` shows it alone, for screenshots.
 */
import { useState } from "react";
import { DarkButton, GhostButton, GoalMeter, CountUp, HeartMeter, PrizeWheel, RewardTrack } from "@/components/gui/flat";
import { welcomeSteps } from "@/components/game/DailyGift";
import { toast } from "@/components/game/ToastHub";
import { iconUrl } from "@/lib/icons/keys";

const PRIZES = ["top_cardigan", "acc_beanie", "acc_straw_hat", "acc_glasses_round", "bottom_pleated_skirt", "acc_plaid_scarf", "top_sweater_vest", "acc_cowboy_hat"]
  .map((k, i) => ({ key: k, label: k.replace(/_/g, " "), picture: <img src={iconUrl(k)} alt="" />, rarity: (["common", "uncommon", "rare", "epic"] as const)[i % 4] }));

export default function FlatRewards() {
  const [halves, setHalves] = useState(3);
  const [day, setDay] = useState(3);
  const [opened, setOpened] = useState(false);
  const [spin, setSpin] = useState(0);
  const [land, setLand] = useState<number | null>(null);
  const [goal, setGoal] = useState(0.42);
  return <div className="gui" data-ui-theme="clean" style={{ display: "grid", gap: 28, padding: 24, borderRadius: 22, background: "var(--ui-panel)", color: "var(--ui-ink)" }} data-testid="flat-rewards">
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <HeartMeter halves={halves} size={22} />
      <GhostButton onClick={() => setHalves(h => Math.max(0, h - 2))}>Hated −1</GhostButton>
      <GhostButton onClick={() => setHalves(h => h + 1)}>Liked +½</GhostButton>
      <DarkButton onClick={() => setHalves(h => Math.min(10, h + 2))}>Loved +1</DarkButton>
    </div>
    <div style={{ display: "grid", gap: 12 }}>
      <RewardTrack steps={welcomeSteps(day, opened)} label={`Welcome week, day ${day}`} />
      <div style={{ display: "flex", gap: 8 }}>
        <GhostButton onClick={() => { setDay(d => (d % 7) + 1); setOpened(false); }}>Next day</GhostButton>
        <DarkButton onClick={() => setOpened(true)}>Open today</DarkButton>
      </div>
    </div>
    <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
      <PrizeWheel key={spin} prizes={PRIZES} land={land} size={260} label="Mystery box" />
      <DarkButton onClick={() => { setSpin(n => n + 1); setLand(null); window.setTimeout(() => setLand(Math.floor(Math.random() * PRIZES.length)), 50); }}>Spin</DarkButton>
    </div>
    <div style={{ display: "grid", gap: 8, maxWidth: 460 }}>
      <GoalMeter key={goal} value={goal} label="Reopen the cafe" marks={["wood_branch", "rock_stone", "monument-banner", "stone-lantern"].map(k => <img key={k} src={iconUrl(k)} alt="" />)} />
      <p style={{ margin: 0, font: "700 26px/1 var(--gui-font)" }}><CountUp n={Math.round(goal * 15000)} /></p>
      <div style={{ display: "flex", gap: 8 }}><GhostButton onClick={() => setGoal(g => (g >= 1 ? 0.1 : Math.min(1, g + 0.27)))}>Chip in</GhostButton>
        <GhostButton onClick={() => toast("Campfire hour. Drums by the fire on the beach.", undefined, { quiet: true })}>Quiet toast</GhostButton></div>
    </div>
  </div>;
}
