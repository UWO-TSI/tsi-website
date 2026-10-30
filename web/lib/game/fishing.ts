/**
 * Fishing data + rules (extracted from FishingOverlay 2026-07-22 so the
 * /lab/fishing bench and the game share ONE source of truth).
 *
 * Refinement rulings (David, 2026-07-22 playtest; rerank 2026-07-24):
 *  - the rarity ladder (lib/rarity.ts): common / uncommon / rare / epic / legendary / divine / contraband.
 *    DIVINE (the old Sea King crown) sits VACANT (rerank ruling): none of the current roster earns
 *    it — David is supplying dedicated marquee models for the tier.
 *    Legendary is deliberately tight (7): the three goldens + Stringfish +
 *    Coelacanth / Hammerhead / Sturgeon.
 *  - Difficulty scales with rarity: bar narrows, fish speed up — and every
 *    species has its OWN movement fields so behavior is parameterized per
 *    fish, not one memorizable pattern.
 *  - Sizes make sense: per-species cm ranges, rolled skew-small on catch.
 *  - The catch card's beats scale with tier (REVEAL: the silhouette's beat, the card's time, soft confetti from rare
 *    up, the camera's shake); rarity colours are the GUI sheet's one palette.
 */

import confetti from "canvas-confetti";
import { getLabHour } from "./devLab";
import { liveIslandWeather, reelWeather } from "./islandWeather";
import { torontoParts } from "@/lib/time";
import { EXTRA_FISH } from "./fishCatalog";
import { worldModel } from "./world/active";
import { weatherMods } from "./weatherPerks";
import { SEASONAL_GOALS } from "@/lib/progression/defaults";
import { ROSTER } from "@/lib/collections/roster";
import { availableAt, type WorldMoment } from "@/lib/collections/logic";

import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
export type { Rarity } from "@/lib/rarity";

export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; weight: number; barW: number }
> = {
  // `color` is the GUI sheet's --gui-rarity-* token (styles/game-tokens.css): one palette for the card, the journal and the book.
  common: { label: RARITY_LABEL.common, color: "#c9bd9f", weight: 100, barW: 0.3 },
  uncommon: { label: RARITY_LABEL.uncommon, color: "#8ac68a", weight: 48, barW: 0.27 },
  rare: { label: RARITY_LABEL.rare, color: "#889df0", weight: 18, barW: 0.24 },
  epic: { label: RARITY_LABEL.epic, color: "#b77dee", weight: 7, barW: 0.21 },
  legendary: { label: RARITY_LABEL.legendary, color: "#f7cd67", weight: 2.5, barW: 0.19 },
  divine: { label: RARITY_LABEL.divine, color: "#b26bff", weight: 0.4, barW: 0.17 },
  // Shut until its earning path is decided (lib/rarity.ts): never rolled.
  contraband: { label: RARITY_LABEL.contraband, color: "#3b2436", weight: 0, barW: 0.15 },
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
  /** Human copy for the availability window (lab bench, the book). */
  whenLabel?: string;
  /** Icon override; absent = the rendered per-key PNG via iconFor(). */
  icon?: string;
  /** Raw dump export: FishCatchFX applies GAME_CALIBRATION (0.1, +90°X). */
  raw?: boolean;
  /** Habitat: river (default) or sea: spots roll their own zone. */
  zone?: "river" | "sea";
  /** Sea-floor creature (not a fish): pulled up at sea spots, grouped
   *  separately in the Collection Book. */
  creature?: boolean;
}

/** Resolve a species' reel/book icon. */
export function iconFor(f: FishDef): string {
  return f.icon ?? `/assets/icons/${f.key}.webp`; // rendered from its model (row 281, lib/icons)
}

// ACNH revamp 2026-07: species-true river catches (models shown in-world by
// FishCatchFX). New species are one row here + one in CollectionBook once
// their model/icon ships (the dump's Creatures/ set has more to extract;
// the next marquee fish takes the Divine crown).
const CORE_FISH: FishRow[] = [
  { key: "fish_dace", label: "a Dace", name: "Dace", model: "/assets/acnh/fish/dace.glb", move: { speed: 0.2, accel: 0.9, jitter: 0.004, dartChance: 0.08, dartMul: 1.8, retargetMs: 1900 } },
  { key: "fish_pale_chub", label: "a Pale Chub", name: "Pale Chub", model: "/assets/acnh/fish/pale-chub.glb", move: { speed: 0.22, accel: 0.9, jitter: 0.006, dartChance: 0.1, dartMul: 1.9, retargetMs: 1800 } },
  { key: "fish_pond_smelt", label: "a Pond Smelt", name: "Pond Smelt", model: "/assets/acnh/fish/pond-smelt.glb", move: { speed: 0.18, accel: 0.7, jitter: 0.005, dartChance: 0.08, dartMul: 1.7, retargetMs: 2000 } },
  { key: "fish_crucian_carp", label: "a Crucian Carp", name: "Crucian Carp", model: "/assets/acnh/fish/crucian-carp.glb", move: { speed: 0.26, accel: 1.0, jitter: 0.005, dartChance: 0.14, dartMul: 1.9, retargetMs: 1600 } },
  { key: "fish_bluegill", label: "a Bluegill", name: "Bluegill", model: "/assets/acnh/fish/bluegill.glb", move: { speed: 0.3, accel: 1.4, jitter: 0.012, dartChance: 0.18, dartMul: 2.0, retargetMs: 1300 } },
  { key: "fish_goldfish", label: "a Goldfish", name: "Goldfish", model: "/assets/acnh/fish/goldfish.glb", move: { speed: 0.27, accel: 1.1, jitter: 0.008, dartChance: 0.12, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_carp", label: "a Carp", name: "Carp", model: "/assets/acnh/fish/carp.glb", move: { speed: 0.3, accel: 1.2, jitter: 0.004, dartChance: 0.16, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_black_bass", label: "a Black Bass", name: "Black Bass", model: "/assets/acnh/fish/black-bass.glb", move: { speed: 0.36, accel: 1.8, jitter: 0.01, dartChance: 0.26, dartMul: 2.3, retargetMs: 1150 } },
  { key: "fish_catfish", label: "a Catfish", name: "Catfish", model: "/assets/acnh/fish/catfish.glb", move: { speed: 0.32, accel: 1.5, jitter: 0.006, dartChance: 0.3, dartMul: 2.6, retargetMs: 1300 } },
  // ── Dump import batch 1 (2026-07-24, calibrated rip): 11 new species.
  { key: "fish_killifish", label: "a Killifish", name: "Killifish", model: "/assets/acnh/fish/killifish.glb", raw: true, move: { speed: 0.19, accel: 0.8, jitter: 0.007, dartChance: 0.09, dartMul: 1.7, retargetMs: 1900 } },
  { key: "fish_loach", label: "a Loach", name: "Loach", model: "/assets/acnh/fish/loach.glb", raw: true, move: { speed: 0.21, accel: 0.85, jitter: 0.005, dartChance: 0.1, dartMul: 1.8, retargetMs: 1850 } },
  { key: "fish_sweetfish", label: "a Sweetfish", name: "Sweetfish", model: "/assets/acnh/fish/sweetfish.glb", raw: true, move: { speed: 0.28, accel: 1.2, jitter: 0.009, dartChance: 0.15, dartMul: 1.9, retargetMs: 1450 } },
  { key: "fish_rainbow_trout", label: "a Rainbow Trout", name: "Rainbow Trout", model: "/assets/acnh/fish/rainbow-trout.glb", raw: true, move: { speed: 0.29, accel: 1.25, jitter: 0.007, dartChance: 0.16, dartMul: 2.0, retargetMs: 1400 } },
  { key: "fish_salmon", label: "a Salmon", name: "Salmon", model: "/assets/acnh/fish/salmon.glb", raw: true, move: { speed: 0.33, accel: 1.4, jitter: 0.006, dartChance: 0.2, dartMul: 2.1, retargetMs: 1300 } },
  { key: "fish_snakehead", label: "a Snakehead", name: "Snakehead", model: "/assets/acnh/fish/snakehead.glb", raw: true, move: { speed: 0.34, accel: 1.6, jitter: 0.008, dartChance: 0.24, dartMul: 2.2, retargetMs: 1250 } },
  { key: "fish_gar", label: "a Gar", name: "Gar", model: "/assets/acnh/fish/gar.glb", raw: true, move: { speed: 0.34, accel: 1.6, jitter: 0.005, dartChance: 0.28, dartMul: 2.5, retargetMs: 1250 } },
  { key: "fish_king_salmon", label: "a King Salmon", name: "King Salmon", model: "/assets/acnh/fish/king-salmon.glb", raw: true, move: { speed: 0.35, accel: 1.7, jitter: 0.006, dartChance: 0.3, dartMul: 2.4, retargetMs: 1200 } },
  { key: "fish_stringfish", label: "a Stringfish", name: "Stringfish", model: "/assets/acnh/fish/stringfish.glb", raw: true, move: { speed: 0.4, accel: 2.0, jitter: 0.01, dartChance: 0.32, dartMul: 2.4, retargetMs: 1050 } },
  { key: "fish_golden_trout", label: "a Golden Trout", name: "Golden Trout", model: "/assets/acnh/fish/golden-trout.glb", raw: true, move: { speed: 0.41, accel: 2.1, jitter: 0.012, dartChance: 0.3, dartMul: 2.3, retargetMs: 1000 } },
  // Golden Arowana (2026-07-24): the last unconverted species model in the
  // dump (ArowanaGold recolor) — closes the fish roster at 81.
  { key: "fish_golden_arowana", label: "a Golden Arowana", name: "Golden Arowana", model: "/assets/acnh/fish/golden-arowana.glb", raw: true, move: { speed: 0.42, accel: 2.1, jitter: 0.01, dartChance: 0.32, dartMul: 2.4, retargetMs: 980 } },
  // Rarity rerank (David ruling 2026-07-24): DIVINE (was Sea King) IS VACANT — David is
  // supplying new marquee models for the tier; the arapaima drops to epic
  // (keeping its king-sized fight). Legendary is deliberately tight: the
  // three goldens + Stringfish + Coelacanth/Hammerhead/Sturgeon.
  { key: "fish_golden_koi", label: "a Golden Koi", name: "Golden Koi", model: "/assets/acnh/fish/koi.glb", move: { speed: 0.44, accel: 2.2, jitter: 0.014, dartChance: 0.34, dartMul: 2.4, retargetMs: 950 } },
  { key: "fish_arapaima", label: "an Arapaima", name: "Arapaima", model: "/assets/acnh/fish/arapaima.glb", raw: true, move: { speed: 0.46, accel: 2.3, jitter: 0.012, dartChance: 0.36, dartMul: 2.5, retargetMs: 900 } },
];


// Sea-floor creatures (2026-07-24): the 10 dive models staged under
// assets/acnh/sea/ (loop iter 25) are now IN the game — pulled up at the
// two sea fishing spots (deck + cove) alongside the sea fish. Slow, heavy
// reel personalities: bottom dwellers cling, they don't sprint. A future
// pier/diving feature can move them to their own mechanic without touching
// these defs.
const SEA_CREATURES: FishRow[] = [
  { key: "sea_scallop", label: "a Scallop", name: "Scallop", model: "/assets/acnh/sea/scallop.glb", creature: true, raw: true, move: { speed: 0.15, accel: 0.6, jitter: 0.004, dartChance: 0.06, dartMul: 1.6, retargetMs: 2200 } },
  { key: "sea_sweet_shrimp", label: "a Sweet Shrimp", name: "Sweet Shrimp", model: "/assets/acnh/sea/sweet-shrimp.glb", creature: true, raw: true, move: { speed: 0.2, accel: 0.85, jitter: 0.008, dartChance: 0.14, dartMul: 2.0, retargetMs: 1700 } },
  { key: "sea_sea_star", label: "a Sea Star", name: "Sea Star", model: "/assets/acnh/sea/sea-star.glb", creature: true, raw: true, move: { speed: 0.12, accel: 0.5, jitter: 0.003, dartChance: 0.04, dartMul: 1.4, retargetMs: 2500 } },
  { key: "sea_barnacle", label: "an Acorn Barnacle", name: "Acorn Barnacle", model: "/assets/acnh/sea/barnacle.glb", creature: true, raw: true, move: { speed: 0.1, accel: 0.45, jitter: 0.003, dartChance: 0.03, dartMul: 1.3, retargetMs: 2600 } },
  { key: "sea_dungeness_crab", label: "a Dungeness Crab", name: "Dungeness Crab", model: "/assets/acnh/sea/dungeness-crab.glb", creature: true, raw: true, move: { speed: 0.24, accel: 1.0, jitter: 0.007, dartChance: 0.16, dartMul: 1.9, retargetMs: 1500 } },
  { key: "sea_garden_eel", label: "a Garden Eel", name: "Garden Eel", model: "/assets/acnh/sea/garden-eel.glb", creature: true, raw: true, move: { speed: 0.26, accel: 1.1, jitter: 0.009, dartChance: 0.18, dartMul: 2.0, retargetMs: 1400 } },
  { key: "sea_firefly_squid", label: "a Firefly Squid", name: "Firefly Squid", model: "/assets/acnh/sea/firefly-squid.glb", creature: true, raw: true, move: { speed: 0.27, accel: 1.15, jitter: 0.01, dartChance: 0.2, dartMul: 2.1, retargetMs: 1350 } },
  { key: "sea_abalone", label: "an Abalone", name: "Abalone", model: "/assets/acnh/sea/abalone.glb", creature: true, raw: true, move: { speed: 0.18, accel: 0.8, jitter: 0.004, dartChance: 0.1, dartMul: 1.7, retargetMs: 1900 } },
  { key: "sea_pearl_oyster", label: "a Pearl Oyster", name: "Pearl Oyster", model: "/assets/acnh/sea/pearl-oyster.glb", creature: true, raw: true, move: { speed: 0.2, accel: 0.9, jitter: 0.005, dartChance: 0.12, dartMul: 1.8, retargetMs: 1800 } },
  { key: "sea_giant_isopod", label: "a Giant Isopod", name: "Giant Isopod", model: "/assets/acnh/sea/giant-isopod.glb", creature: true, raw: true, move: { speed: 0.3, accel: 1.4, jitter: 0.007, dartChance: 0.26, dartMul: 2.3, retargetMs: 1250 } },
];

/**
 * The quarter turn about x that hangs a raw dump export (10x, its head along +z, its back up) head up with its back
 * toward -z, the frame the hold, the tank and the icons assume: -90 degrees (game/remodel round 3). Only the sea creatures
 * are raw (the fish are ours, in frame).
 */
export const RAW_TURN_X = -Math.PI / 2;

/** A reel row: its rarity, size, habitat and hours are the roster's (lib/collections/roster.ts), the one place they're set. */
export type FishRow = Omit<FishDef, "rarity" | "sizeCm" | "zone" | "when" | "whenLabel">;
const SPECIES = new Map(ROSTER.map((s) => [s.key, s]));
const hoursLabel = ({ hours: [a, b], rainAnyHour, weather }: { hours: [number, number]; rainAnyHour: boolean; weather: string[] }) =>
  `${a}-${b}h${rainAnyHour ? " or rain" : ""}${weather.length ? `, ${weather.join(" or ")} only` : ""}`;

/** Every species, with the roster's rarity, size, habitat and hours; in the new world the fish are our tweaked models (worldModel, art/remodel/build_fish.py), already in the game's frame, so none of them is raw there. */
export const FISH: FishDef[] = [...CORE_FISH, ...EXTRA_FISH, ...SEA_CREATURES].map(f => {
  const s = SPECIES.get(f.key);
  if (!s?.size) throw new Error(`${f.key}: a reel fish needs a roster row with a size`);
  const gated = s.hours || s.weather.length ? { ...s, months: [] } : null;
  const model = worldModel(f.model);
  return {
    ...f, model, raw: f.raw && model === f.model, rarity: s.rarity, sizeCm: s.size, zone: s.biome === "sea" ? "sea" : "river",
    ...(gated && {
      when: (hour: number, weather: string) => availableAt(gated, { hour, month: 1, weather: weather as WorldMoment["weather"] }),
      whenLabel: gated.hours ? hoursLabel({ ...gated, hours: gated.hours }) : `${gated.weather.join(" or ")} only`,
    }),
  };
});

/**
 * Limited-time catches (specs/seasonal-events.md): species a seasonal goal
 * gates bite only while their event runs. The server roll passes the sets for
 * its own clock in the context (lib/collections/rolls.ts fishRoll); the
 * island's local fallback reel uses the ones the world sets from the club
 * goals and the world clock (lib/game/seasonalEvents.ts). Until told, the
 * seeded events' catches are shut.
 */
export interface EventCatches { limited: ReadonlySet<string>; open: ReadonlySet<string> }
let eventCatches: EventCatches = { limited: new Set(SEASONAL_GOALS.flatMap((g) => g.event.catches)), open: new Set() };
export function setEventCatches(next: EventCatches): void {
  eventCatches = next;
}
/** `month` (1-12, Toronto): fish with a roster months list only bite in those months (David, 2026-09-30); absent = any month. */
export interface FishingContext { hour: number; weather: string; month?: number; catches?: EventCatches }
/** Roster months per species that has a season (the journal's and catch board's "Sep–Nov"). */
const SEASON_MONTHS = new Map(ROSTER.filter((s) => s.months.length).map((s) => [s.key, s.months]));
const biting = (f: FishDef, zone: "river" | "sea", { hour, weather, month, catches = eventCatches }: FishingContext) => {
  if ((f.zone ?? "river") !== zone || (f.when && !f.when(hour, weather))) return false;
  // A limited-time fish's season is its event's window, wherever an admin puts it.
  if (catches.limited.has(f.key)) return catches.open.has(f.key);
  return month === undefined || (SEASON_MONTHS.get(f.key)?.includes(month) ?? true);
};

/** The reel's context: Toronto hour and month and the island's weather, as the server roll sees them (lib/collections/rolls.ts). */
export function currentFishingContext(): FishingContext {
  const { hour, minute, month } = torontoParts();
  return { hour: getLabHour() ?? hour + minute / 60, weather: reelWeather(liveIslandWeather()), month };
}

export function fishWeight(f: FishDef, weather: string): number {
  let w = RARITY_META[f.rarity].weight;
  if (f.key === "fish_golden_koi" && weather === "rain") w *= 2; // koi loves rain
  if ((f.zone ?? "river") === "sea") w *= weatherMods(weather).seaWeightMul;
  return w;
}

/** Cast-meter tuning (David 2026-07-23): hold E → vertical ping-pong bar,
 *  release at the tip = MAX CAST. Power scales BOTH luck and bite timing. */
export const CAST = {
  cycleMs: 1400, // base ping-pong period — the meter speeds up 15%/cycle while held
  maxZone: 0.92, // release at p >= this = MAX CAST
  maxBonus: 0.3, // extra luck on a MAX release
  waitScale: 0.5, // max power halves the 2-6s wait
  biteBonusMs: 800, // max power widens the 1.4s hook window by this
};

/**
 * Fishing together (s-fishtogether, specs/launch/v1-gameplay.md): a cast within `range` (a few steps) of a friend rolls
 * with `luck` more (a small rare-odds boost, a third of a MAX cast's) and the catch card wears a "Fished with" stamp. Each
 * of you gets it on your own casts. The server checks you're friends (POST /api/collections cast `with`).
 */
export const TOGETHER = { luck: 0.1, range: 4 } as const;

/** Luck-aware weight: cast power inflates rare-and-up odds (max ≈ 2×). */
function luckWeight(f: FishDef, weather: string, luck: number): number {
  let w = fishWeight(f, weather);
  if (luck > 0 && f.rarity !== "common" && f.rarity !== "uncommon") w *= 1 + luck;
  return w;
}

/** Available weighted catches, including weather luck, shared with the QA bench. */
export function fishingPool(luck = 0, zone: "river" | "sea" = "river", context: FishingContext = currentFishingContext()) {
  const { weather } = context;
  const totalLuck = luck + weatherMods(weather).rareLuckBonus;
  return FISH
    .filter((f) => biting(f, zone, context))
    .map((fish) => ({ fish, weight: luckWeight(fish, weather, totalLuck) }));
}

/** Weighted roll over the species available right now. luck 0..~1.3 from
 *  cast power — see CAST. */
export function rollFish(luck = 0, zone: "river" | "sea" = "river", context: FishingContext = currentFishingContext()): FishDef {
  const pool = fishingPool(luck, zone, context);
  const total = pool.reduce((s, entry) => s + entry.weight, 0);
  let r = Math.random() * total;
  for (const { fish, weight } of pool) {
    r -= weight;
    if (r <= 0) return fish;
  }
  return pool[pool.length - 1].fish;
}

/** Skewed size roll — most catches modest, big ones are the brag. */
export function rollSize([min, max]: [number, number], random = Math.random): number {
  return Math.round(min + (max - min) * Math.pow(random(), 1.7));
}

// ─── Reel tuning (track space is 0..1; bar width comes from rarity) ─────────
export const HOLD_ACCEL = 3.6; // hold LMB → push right
export const GRAVITY = 3.1; // release → fall left
export const DAMPING = 1.4; // exponential velocity damping /s
export const EDGE_BOUNCE = 0.35; // left-edge elasticity (Stardew's bottom bounce)
export const FILL_RATE = 0.26; // progress /s while the fish is inside the bar
export const START_PROGRESS = 0.35;

/**
 * The catch card's beats by tier (the cozy cream direction, specs/polish/fishing.md deliverable 5; FishReveal): how
 * long a first catch keeps its silhouette before it develops, how long the card stays, how many soft confetti bursts
 * (from rare up), and the camera's shake as the catch comes out of the water (world units, cameraJuice shakeCamera).
 * All times ms.
 */
export const REVEAL: Record<Rarity, { develop: number; hold: number; confetti: number; shake: number }> = {
  common: { develop: 450, hold: 3000, confetti: 0, shake: 0.025 },
  uncommon: { develop: 550, hold: 3200, confetti: 0, shake: 0.03 },
  rare: { develop: 700, hold: 3600, confetti: 1, shake: 0.04 },
  epic: { develop: 850, hold: 4000, confetti: 2, shake: 0.05 },
  legendary: { develop: 1000, hold: 4600, confetti: 3, shake: 0.06 },
  divine: { develop: 1200, hold: 5200, confetti: 4, shake: 0.07 },
  contraband: { develop: 1300, hold: 5400, confetti: 4, shake: 0.075 },
};

/**
 * The hook's beat by tier (specs/launch/v1-gameplay.md, "Fish tiers and fights"): every bite pops a "!" over the
 * angler; a legendary's is golden with sparks, a divine's bigger still with a beam and a burst. Each has its own bite
 * sound (art/audio/synth_bite.py) and a harder shake (world units, cameraJuice shakeCamera) and micro-zoom (degrees).
 * Hooked, a legendary or divine catch surfaces in a cutscene (`surfaceMs`, fishing/BossCreature.tsx) before its fight.
 */
export type HookTier = "common" | "legendary" | "divine";
export const HOOK_TIER: Record<Rarity, HookTier> = {
  common: "common", uncommon: "common", rare: "common", epic: "common", legendary: "legendary", divine: "divine", contraband: "common",
};
export const HOOK: Record<HookTier, { sfx: "bite" | "bite-legendary" | "bite-divine"; shake: number; punch: number; surfaceMs: number }> = {
  common: { sfx: "bite", shake: 0.065, punch: 3, surfaceMs: 0 },
  legendary: { sfx: "bite-legendary", shake: 0.12, punch: 4.5, surfaceMs: 2800 },
  divine: { sfx: "bite-divine", shake: 0.2, punch: 6, surfaceMs: 3800 },
};

/**
 * The boss fights (a legendary's boss reel and surfacing cutscene, a divine's room raid) are for a later launch (David,
 * 2026-10-27): off unless the build sets NEXT_PUBLIC_FISH_BOSSES=1. Off, every catch reels the ordinary way; the "!"
 * and the bite sound still go by tier.
 */
export const fishBosses = () => process.env.NEXT_PUBLIC_FISH_BOSSES === "1";
/** The fight a catch puts up: a boss reel of your own (legendary), the room's raid (divine), or none. */
export function bossOf(rarity: Rarity): "solo" | "shared" | null {
  if (!fishBosses()) return null;
  const tier = HOOK_TIER[rarity];
  return tier === "legendary" ? "solo" : tier === "divine" ? "shared" : null;
}

/** "1 in N" odds for a species under the current hour/weather pool. */
export function fishOdds(fish: FishDef): number {
  const context = currentFishingContext(), { weather } = context;
  // Odds are within the species' own zone pool (a sea catch competes with
  // the sea roster, not the whole book).
  const zone = fish.zone ?? "river";
  const pool = FISH.filter((f) => biting(f, zone, context));
  const total = pool.reduce((s, f) => s + fishWeight(f, weather), 0);
  const w = fishWeight(fish, weather);
  return Math.max(1, Math.round(total / w));
}

/** The catch's camera shake by tier (world units for cameraJuice's shakeCamera; the callers in the world shake it). */
export const catchShake = (rarity: Rarity) => REVEAL[rarity].shake;

/**
 * Soft paper confetti for a catch from rare up (none below): a few small pastel pieces in the rarity's colour, cream
 * and butter, drifting down from `origin` (the card), more bursts for the rarer. No-op with reduced motion.
 */
export function celebrate(rarity: Rarity, color: string, origin: { x: number; y: number } = { x: 0.5, y: 0.72 }) {
  const bursts = REVEAL[rarity].confetti;
  for (let i = 0; i < bursts; i++) {
    window.setTimeout(() => {
      confetti({
        particleCount: 16 + i * 8,
        spread: 70 + i * 10,
        startVelocity: 20 + i * 3,
        gravity: 0.65,
        drift: (i % 2 ? 1 : -1) * 0.3,
        decay: 0.92,
        scalar: 0.72,
        ticks: 240,
        shapes: ["circle", "square"],
        origin,
        colors: [color, "#fffbe7", "#ffeea0"],
        disableForReducedMotion: true,
      });
    }, i * 260);
  }
}
