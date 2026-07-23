/**
 * Fishing data + rules (extracted from FishingOverlay 2026-07-22 so the
 * /lab/fishing bench and the game share ONE source of truth).
 *
 * Refinement rulings (David, 2026-07-22 playtest):
 *  - 6 rarity tiers: common / uncommon / rare / epic / legendary / sea king.
 *    Legendary sits VACANT until the next marquee extraction (then the new
 *    fish takes Sea King and the koi drops to legendary — "Both" ruling).
 *  - Difficulty scales with rarity: bar narrows, fish speed up — and every
 *    species has its OWN movement fields so behavior is parameterized per
 *    fish, not one memorizable pattern.
 *  - Sizes make sense: per-species cm ranges, rolled skew-small on catch.
 *  - Celebration scales with tier (shake px, confetti bursts, card time).
 */

import confetti from "canvas-confetti";
import { getTodayWeather } from "./weather";
import { getLabHour } from "./devLab";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "seaking";

export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; weight: number; barW: number }
> = {
  common: { label: "Common", color: "#7C9A62", weight: 100, barW: 0.3 },
  uncommon: { label: "Uncommon", color: "#4A90D9", weight: 48, barW: 0.27 },
  rare: { label: "Rare", color: "#9B6DD6", weight: 18, barW: 0.24 },
  epic: { label: "Epic", color: "#D6598F", weight: 7, barW: 0.21 },
  legendary: { label: "Legendary", color: "#E8A93C", weight: 2.5, barW: 0.19 },
  seaking: { label: "Sea King", color: "#1FB6CF", weight: 1, barW: 0.17 },
};

/** Per-species reel behavior — track space is 0..1, speeds in track/s. */
export interface FishMove {
  speed: number; // top cruising speed
  accel: number; // how hard it pulls toward its target (track/s²)
  jitter: number; // constant nervous wobble amplitude
  dartChance: number; // chance a retarget is a dart
  dartMul: number; // speed/accel multiplier while darting
  retargetMs: number; // base time between new targets
}

export interface FishDef {
  key: string;
  label: string; // "a Dace" — result copy
  name: string; // "Dace" — reel card
  model: string;
  rarity: Rarity;
  sizeCm: [number, number];
  move: FishMove;
  /** Availability gate; absent = always biting. Hour is 0-24 local. */
  when?: (hour: number, weather: string) => boolean;
  /** Human copy for the availability window (lab bench + future almanac). */
  whenLabel?: string;
}

// ACNH revamp 2026-07: species-true river catches (models shown in-world by
// FishCatchFX). New species are one row here + one in CollectionBook once
// their model/icon ships (the dump's Creatures/ set has more to extract;
// the next marquee fish takes the Sea King crown).
export const FISH: FishDef[] = [
  { key: "fish_dace", label: "a Dace", name: "Dace", model: "/assets/acnh/fish/dace.glb", rarity: "common", sizeCm: [10, 18], move: { speed: 0.2, accel: 0.9, jitter: 0.004, dartChance: 0.08, dartMul: 1.8, retargetMs: 1900 } },
  { key: "fish_pale_chub", label: "a Pale Chub", name: "Pale Chub", model: "/assets/acnh/fish/pale-chub.glb", rarity: "common", sizeCm: [8, 14], move: { speed: 0.22, accel: 0.9, jitter: 0.006, dartChance: 0.1, dartMul: 1.9, retargetMs: 1800 }, when: (h) => h >= 6 && h < 18, whenLabel: "day (6-18h)" },
  { key: "fish_pond_smelt", label: "a Pond Smelt", name: "Pond Smelt", model: "/assets/acnh/fish/pond-smelt.glb", rarity: "common", sizeCm: [6, 10], move: { speed: 0.18, accel: 0.7, jitter: 0.005, dartChance: 0.08, dartMul: 1.7, retargetMs: 2000 } },
  { key: "fish_crucian_carp", label: "a Crucian Carp", name: "Crucian Carp", model: "/assets/acnh/fish/crucian-carp.glb", rarity: "uncommon", sizeCm: [15, 30], move: { speed: 0.26, accel: 1.0, jitter: 0.005, dartChance: 0.14, dartMul: 1.9, retargetMs: 1600 } },
  { key: "fish_bluegill", label: "a Bluegill", name: "Bluegill", model: "/assets/acnh/fish/bluegill.glb", rarity: "uncommon", sizeCm: [12, 22], move: { speed: 0.3, accel: 1.4, jitter: 0.012, dartChance: 0.18, dartMul: 2.0, retargetMs: 1300 }, when: (h) => h >= 9 && h < 16, whenLabel: "midday (9-16h)" },
  { key: "fish_goldfish", label: "a Goldfish", name: "Goldfish", model: "/assets/acnh/fish/goldfish.glb", rarity: "uncommon", sizeCm: [8, 15], move: { speed: 0.27, accel: 1.1, jitter: 0.008, dartChance: 0.12, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_carp", label: "a Carp", name: "Carp", model: "/assets/acnh/fish/carp.glb", rarity: "rare", sizeCm: [35, 70], move: { speed: 0.3, accel: 1.2, jitter: 0.004, dartChance: 0.16, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_black_bass", label: "a Black Bass", name: "Black Bass", model: "/assets/acnh/fish/black-bass.glb", rarity: "rare", sizeCm: [30, 55], move: { speed: 0.36, accel: 1.8, jitter: 0.01, dartChance: 0.26, dartMul: 2.3, retargetMs: 1150 } },
  { key: "fish_catfish", label: "a Catfish", name: "Catfish", model: "/assets/acnh/fish/catfish.glb", rarity: "epic", sizeCm: [50, 110], move: { speed: 0.32, accel: 1.5, jitter: 0.006, dartChance: 0.3, dartMul: 2.6, retargetMs: 1300 }, when: (h, w) => h >= 20 || h < 4 || w === "rain", whenLabel: "night (20-4h) or rain" },
  // Legendary rung intentionally vacant — see header note.
  { key: "fish_golden_koi", label: "a Golden Koi", name: "Golden Koi", model: "/assets/acnh/fish/koi.glb", rarity: "seaking", sizeCm: [60, 95], move: { speed: 0.44, accel: 2.2, jitter: 0.014, dartChance: 0.34, dartMul: 2.4, retargetMs: 950 } },
];

export function currentFishingContext(): { hour: number; weather: string } {
  const hour = getLabHour() ?? new Date().getHours() + new Date().getMinutes() / 60;
  return { hour, weather: getTodayWeather() };
}

export function fishWeight(f: FishDef, weather: string): number {
  let w = RARITY_META[f.rarity].weight;
  if (f.key === "fish_golden_koi" && weather === "rain") w *= 2; // koi loves rain
  return w;
}

/** Weighted roll over the species available right now. */
export function rollFish(): FishDef {
  const { hour, weather } = currentFishingContext();
  const pool = FISH.filter((f) => !f.when || f.when(hour, weather));
  const total = pool.reduce((s, f) => s + fishWeight(f, weather), 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= fishWeight(f, weather);
    if (r <= 0) return f;
  }
  return pool[pool.length - 1];
}

/** Skewed size roll — most catches modest, big ones are the brag. */
export function rollSize([min, max]: [number, number]): number {
  return Math.round(min + (max - min) * Math.pow(Math.random(), 1.7));
}

// ─── Reel tuning (track space is 0..1; bar width comes from rarity) ─────────
export const HOLD_ACCEL = 3.6; // hold LMB → push right
export const GRAVITY = 3.1; // release → fall left
export const DAMPING = 1.4; // exponential velocity damping /s
export const EDGE_BOUNCE = 0.35; // left-edge elasticity (Stardew's bottom bounce)
export const FILL_RATE = 0.26; // progress /s while the fish is inside the bar
export const START_PROGRESS = 0.35;

/** Tier-scaled catch celebration: shake px, confetti bursts, card ms. */
export const CELEBRATE: Record<Rarity, { shake: number; bursts: number; cardMs: number; glow: boolean }> = {
  common: { shake: 4, bursts: 0, cardMs: 2600, glow: false },
  uncommon: { shake: 4, bursts: 0, cardMs: 2600, glow: false },
  rare: { shake: 6, bursts: 1, cardMs: 3000, glow: false },
  epic: { shake: 8, bursts: 2, cardMs: 3200, glow: false },
  legendary: { shake: 10, bursts: 3, cardMs: 3800, glow: true },
  seaking: { shake: 12, bursts: 4, cardMs: 4200, glow: true },
};

export function celebrate(rarity: Rarity, color: string) {
  const c = CELEBRATE[rarity];
  // Screen shake — amplitude by tier (no-op when no canvas is mounted,
  // e.g. on the lab bench).
  const a = c.shake;
  document.querySelector("canvas")?.animate(
    [
      { transform: "translate(0,0)" },
      { transform: `translate(${a}px,${-a / 2}px)` },
      { transform: `translate(${-a}px,${a / 2}px)` },
      { transform: `translate(${a / 2}px,${a / 3}px)` },
      { transform: "translate(0,0)" },
    ],
    { duration: 90 + a * 25 }
  );
  // Confetti from rare up; tier-tinted for the crown tiers.
  for (let i = 0; i < c.bursts; i++) {
    window.setTimeout(() => {
      confetti({
        particleCount: 50 + i * 40,
        spread: 65 + i * 12,
        startVelocity: 38,
        origin: { x: 0.5, y: 0.72 },
        colors: [color, "#FFD166", "#FFFDF5"],
        disableForReducedMotion: true,
      });
    }, i * 220);
  }
}
