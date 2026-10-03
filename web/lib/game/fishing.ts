/**
 * Fishing data + rules (extracted from FishingOverlay 2026-07-22 so the
 * /lab/fishing bench and the game share ONE source of truth).
 *
 * Refinement rulings (David, 2026-07-22 playtest; rerank 2026-07-24):
 *  - 6 rarity tiers: common / uncommon / rare / epic / legendary / sea king.
 *    SEA KING sits VACANT (rerank ruling): none of the current roster earns
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
import { weatherMods } from "./weatherPerks";
import { SEASONAL_GOALS } from "@/lib/progression/defaults";
import { ROSTER } from "@/lib/collections/roster";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "seaking";

/**
 * Sea King is HOLOGRAPHIC (David ruling 2026-07-23): chips render this
 * animated iridescent gradient instead of the flat tier color. Pair with
 * the `tsi-holo-shift` keyframes (defined wherever chips render).
 */
export const HOLO_GRADIENT =
  "linear-gradient(115deg, #5EE7F7 0%, #6EA8FF 18%, #B57AFF 38%, #FF7AD9 58%, #7DFFC4 78%, #5EE7F7 100%)";

export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; weight: number; barW: number }
> = {
  // `color` is the GUI sheet's --gui-rarity-* token (styles/game-tokens.css): one palette for the card, the journal and the book.
  common: { label: "Common", color: "#c9bd9f", weight: 100, barW: 0.3 },
  uncommon: { label: "Uncommon", color: "#8ac68a", weight: 48, barW: 0.27 },
  rare: { label: "Rare", color: "#889df0", weight: 18, barW: 0.24 },
  epic: { label: "Epic", color: "#b77dee", weight: 7, barW: 0.21 },
  legendary: { label: "Legendary", color: "#f7cd67", weight: 2.5, barW: 0.19 },
  seaking: { label: "Sea King", color: "#7fd6dc", weight: 1, barW: 0.17 },
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
  /** Icon override; absent = the rendered per-key PNG via iconFor(). */
  icon?: string;
  /** Raw dump export: FishCatchFX applies GAME_CALIBRATION (0.1, +90°X). */
  raw?: boolean;
  /** Habitat: river (default) or sea — spots roll their own zone. */
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
// the next marquee fish takes the Sea King crown).
const CORE_FISH: FishDef[] = [
  { key: "fish_dace", label: "a Dace", name: "Dace", model: "/assets/acnh/fish/dace.glb", rarity: "common", sizeCm: [10, 18], move: { speed: 0.2, accel: 0.9, jitter: 0.004, dartChance: 0.08, dartMul: 1.8, retargetMs: 1900 } },
  { key: "fish_pale_chub", label: "a Pale Chub", name: "Pale Chub", model: "/assets/acnh/fish/pale-chub.glb", rarity: "common", sizeCm: [8, 14], move: { speed: 0.22, accel: 0.9, jitter: 0.006, dartChance: 0.1, dartMul: 1.9, retargetMs: 1800 }, when: (h) => h >= 6 && h < 18, whenLabel: "day (6-18h)" },
  { key: "fish_pond_smelt", label: "a Pond Smelt", name: "Pond Smelt", model: "/assets/acnh/fish/pond-smelt.glb", rarity: "common", sizeCm: [6, 10], move: { speed: 0.18, accel: 0.7, jitter: 0.005, dartChance: 0.08, dartMul: 1.7, retargetMs: 2000 } },
  { key: "fish_crucian_carp", label: "a Crucian Carp", name: "Crucian Carp", model: "/assets/acnh/fish/crucian-carp.glb", rarity: "uncommon", sizeCm: [15, 30], move: { speed: 0.26, accel: 1.0, jitter: 0.005, dartChance: 0.14, dartMul: 1.9, retargetMs: 1600 } },
  { key: "fish_bluegill", label: "a Bluegill", name: "Bluegill", model: "/assets/acnh/fish/bluegill.glb", rarity: "uncommon", sizeCm: [12, 22], move: { speed: 0.3, accel: 1.4, jitter: 0.012, dartChance: 0.18, dartMul: 2.0, retargetMs: 1300 }, when: (h) => h >= 9 && h < 16, whenLabel: "midday (9-16h)" },
  { key: "fish_goldfish", label: "a Goldfish", name: "Goldfish", model: "/assets/acnh/fish/goldfish.glb", rarity: "uncommon", sizeCm: [8, 15], move: { speed: 0.27, accel: 1.1, jitter: 0.008, dartChance: 0.12, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_carp", label: "a Carp", name: "Carp", model: "/assets/acnh/fish/carp.glb", rarity: "uncommon", sizeCm: [35, 70], move: { speed: 0.3, accel: 1.2, jitter: 0.004, dartChance: 0.16, dartMul: 1.8, retargetMs: 1500 } },
  { key: "fish_black_bass", label: "a Black Bass", name: "Black Bass", model: "/assets/acnh/fish/black-bass.glb", rarity: "rare", sizeCm: [30, 55], move: { speed: 0.36, accel: 1.8, jitter: 0.01, dartChance: 0.26, dartMul: 2.3, retargetMs: 1150 } },
  { key: "fish_catfish", label: "a Catfish", name: "Catfish", model: "/assets/acnh/fish/catfish.glb", rarity: "epic", sizeCm: [50, 110], move: { speed: 0.32, accel: 1.5, jitter: 0.006, dartChance: 0.3, dartMul: 2.6, retargetMs: 1300 }, when: (h, w) => h >= 20 || h < 4 || w === "rain", whenLabel: "night (20-4h) or rain" },
  // ── Dump import batch 1 (2026-07-24, calibrated rip): 11 new species.
  { key: "fish_killifish", label: "a Killifish", name: "Killifish", model: "/assets/acnh/fish/killifish.glb", rarity: "common", sizeCm: [3, 5], raw: true, move: { speed: 0.19, accel: 0.8, jitter: 0.007, dartChance: 0.09, dartMul: 1.7, retargetMs: 1900 }, when: (h) => h >= 6 && h < 20, whenLabel: "day (6-20h)" },
  { key: "fish_loach", label: "a Loach", name: "Loach", model: "/assets/acnh/fish/loach.glb", rarity: "common", sizeCm: [12, 20], raw: true, move: { speed: 0.21, accel: 0.85, jitter: 0.005, dartChance: 0.1, dartMul: 1.8, retargetMs: 1850 } },
  { key: "fish_sweetfish", label: "a Sweetfish", name: "Sweetfish", model: "/assets/acnh/fish/sweetfish.glb", rarity: "uncommon", sizeCm: [18, 30], raw: true, move: { speed: 0.28, accel: 1.2, jitter: 0.009, dartChance: 0.15, dartMul: 1.9, retargetMs: 1450 } },
  { key: "fish_rainbow_trout", label: "a Rainbow Trout", name: "Rainbow Trout", model: "/assets/acnh/fish/rainbow-trout.glb", rarity: "uncommon", sizeCm: [30, 50], raw: true, move: { speed: 0.29, accel: 1.25, jitter: 0.007, dartChance: 0.16, dartMul: 2.0, retargetMs: 1400 }, when: (h) => h >= 5 && h < 19, whenLabel: "day (5-19h)" },
  { key: "fish_salmon", label: "a Salmon", name: "Salmon", model: "/assets/acnh/fish/salmon.glb", rarity: "uncommon", sizeCm: [50, 80], raw: true, move: { speed: 0.33, accel: 1.4, jitter: 0.006, dartChance: 0.2, dartMul: 2.1, retargetMs: 1300 } },
  { key: "fish_snakehead", label: "a Snakehead", name: "Snakehead", model: "/assets/acnh/fish/snakehead.glb", rarity: "rare", sizeCm: [40, 90], raw: true, move: { speed: 0.34, accel: 1.6, jitter: 0.008, dartChance: 0.24, dartMul: 2.2, retargetMs: 1250 }, when: (h) => h >= 9 && h < 16, whenLabel: "midday (9-16h)" },
  { key: "fish_gar", label: "a Gar", name: "Gar", model: "/assets/acnh/fish/gar.glb", rarity: "epic", sizeCm: [90, 150], raw: true, move: { speed: 0.34, accel: 1.6, jitter: 0.005, dartChance: 0.28, dartMul: 2.5, retargetMs: 1250 }, when: (h, w) => h >= 16 || h < 9 || w === "rain", whenLabel: "evening/night or rain" },
  { key: "fish_king_salmon", label: "a King Salmon", name: "King Salmon", model: "/assets/acnh/fish/king-salmon.glb", rarity: "epic", sizeCm: [70, 120], raw: true, move: { speed: 0.35, accel: 1.7, jitter: 0.006, dartChance: 0.3, dartMul: 2.4, retargetMs: 1200 } },
  { key: "fish_stringfish", label: "a Stringfish", name: "Stringfish", model: "/assets/acnh/fish/stringfish.glb", rarity: "legendary", sizeCm: [80, 130], raw: true, move: { speed: 0.4, accel: 2.0, jitter: 0.01, dartChance: 0.32, dartMul: 2.4, retargetMs: 1050 }, when: (h, w) => h >= 21 || h < 4 || w === "rain", whenLabel: "late night or rain" },
  { key: "fish_golden_trout", label: "a Golden Trout", name: "Golden Trout", model: "/assets/acnh/fish/golden-trout.glb", rarity: "legendary", sizeCm: [40, 60], raw: true, move: { speed: 0.41, accel: 2.1, jitter: 0.012, dartChance: 0.3, dartMul: 2.3, retargetMs: 1000 } },
  // Golden Arowana (2026-07-24): the last unconverted species model in the
  // dump (ArowanaGold recolor) — closes the fish roster at 81.
  { key: "fish_golden_arowana", label: "a Golden Arowana", name: "Golden Arowana", model: "/assets/acnh/fish/golden-arowana.glb", rarity: "legendary", sizeCm: [70, 100], raw: true, move: { speed: 0.42, accel: 2.1, jitter: 0.01, dartChance: 0.32, dartMul: 2.4, retargetMs: 980 }, when: (h) => h >= 20 || h < 4, whenLabel: "night (20-4h)" },
  // Rarity rerank (David ruling 2026-07-24): SEA KING IS VACANT — David is
  // supplying new marquee models for the tier; the arapaima drops to epic
  // (keeping its king-sized fight). Legendary is deliberately tight: the
  // three goldens + Stringfish + Coelacanth/Hammerhead/Sturgeon.
  { key: "fish_golden_koi", label: "a Golden Koi", name: "Golden Koi", model: "/assets/acnh/fish/koi.glb", rarity: "legendary", sizeCm: [60, 95], move: { speed: 0.44, accel: 2.2, jitter: 0.014, dartChance: 0.34, dartMul: 2.4, retargetMs: 950 } },
  { key: "fish_arapaima", label: "an Arapaima", name: "Arapaima", model: "/assets/acnh/fish/arapaima.glb", rarity: "epic", sizeCm: [150, 300], raw: true, move: { speed: 0.46, accel: 2.3, jitter: 0.012, dartChance: 0.36, dartMul: 2.5, retargetMs: 900 }, when: (h, w) => h >= 16 || h < 9 || w === "rain", whenLabel: "evening/night or rain" },
];


// Sea-floor creatures (2026-07-24): the 10 dive models staged under
// assets/acnh/sea/ (loop iter 25) are now IN the game — pulled up at the
// two sea fishing spots (deck + cove) alongside the sea fish. Slow, heavy
// reel personalities: bottom dwellers cling, they don't sprint. A future
// pier/diving feature can move them to their own mechanic without touching
// these defs.
const SEA_CREATURES: FishDef[] = [
  { key: "sea_scallop", label: "a Scallop", name: "Scallop", model: "/assets/acnh/sea/scallop.glb", rarity: "common", zone: "sea", creature: true, sizeCm: [8, 14], raw: true, move: { speed: 0.15, accel: 0.6, jitter: 0.004, dartChance: 0.06, dartMul: 1.6, retargetMs: 2200 } },
  { key: "sea_sweet_shrimp", label: "a Sweet Shrimp", name: "Sweet Shrimp", model: "/assets/acnh/sea/sweet-shrimp.glb", rarity: "common", zone: "sea", creature: true, sizeCm: [5, 9], raw: true, move: { speed: 0.2, accel: 0.85, jitter: 0.008, dartChance: 0.14, dartMul: 2.0, retargetMs: 1700 }, when: (h) => h >= 16 || h < 9, whenLabel: "evening/night" },
  { key: "sea_sea_star", label: "a Sea Star", name: "Sea Star", model: "/assets/acnh/sea/sea-star.glb", rarity: "common", zone: "sea", creature: true, sizeCm: [8, 15], raw: true, move: { speed: 0.12, accel: 0.5, jitter: 0.003, dartChance: 0.04, dartMul: 1.4, retargetMs: 2500 } },
  { key: "sea_barnacle", label: "an Acorn Barnacle", name: "Acorn Barnacle", model: "/assets/acnh/sea/barnacle.glb", rarity: "common", zone: "sea", creature: true, sizeCm: [2, 4], raw: true, move: { speed: 0.1, accel: 0.45, jitter: 0.003, dartChance: 0.03, dartMul: 1.3, retargetMs: 2600 } },
  { key: "sea_dungeness_crab", label: "a Dungeness Crab", name: "Dungeness Crab", model: "/assets/acnh/sea/dungeness-crab.glb", rarity: "uncommon", zone: "sea", creature: true, sizeCm: [15, 25], raw: true, move: { speed: 0.24, accel: 1.0, jitter: 0.007, dartChance: 0.16, dartMul: 1.9, retargetMs: 1500 } },
  { key: "sea_garden_eel", label: "a Garden Eel", name: "Garden Eel", model: "/assets/acnh/sea/garden-eel.glb", rarity: "uncommon", zone: "sea", creature: true, sizeCm: [30, 40], raw: true, move: { speed: 0.26, accel: 1.1, jitter: 0.009, dartChance: 0.18, dartMul: 2.0, retargetMs: 1400 }, when: (h) => h >= 6 && h < 18, whenLabel: "day (6-18h)" },
  { key: "sea_firefly_squid", label: "a Firefly Squid", name: "Firefly Squid", model: "/assets/acnh/sea/firefly-squid.glb", rarity: "uncommon", zone: "sea", creature: true, sizeCm: [5, 8], raw: true, move: { speed: 0.27, accel: 1.15, jitter: 0.01, dartChance: 0.2, dartMul: 2.1, retargetMs: 1350 }, when: (h) => h >= 21 || h < 4, whenLabel: "late night (21-4h)" },
  { key: "sea_abalone", label: "an Abalone", name: "Abalone", model: "/assets/acnh/sea/abalone.glb", rarity: "rare", zone: "sea", creature: true, sizeCm: [12, 20], raw: true, move: { speed: 0.18, accel: 0.8, jitter: 0.004, dartChance: 0.1, dartMul: 1.7, retargetMs: 1900 }, when: (h) => h >= 16 || h < 9, whenLabel: "evening/night" },
  { key: "sea_pearl_oyster", label: "a Pearl Oyster", name: "Pearl Oyster", model: "/assets/acnh/sea/pearl-oyster.glb", rarity: "rare", zone: "sea", creature: true, sizeCm: [7, 12], raw: true, move: { speed: 0.2, accel: 0.9, jitter: 0.005, dartChance: 0.12, dartMul: 1.8, retargetMs: 1800 } },
  { key: "sea_giant_isopod", label: "a Giant Isopod", name: "Giant Isopod", model: "/assets/acnh/sea/giant-isopod.glb", rarity: "epic", zone: "sea", creature: true, sizeCm: [20, 40], raw: true, move: { speed: 0.3, accel: 1.4, jitter: 0.007, dartChance: 0.26, dartMul: 2.3, retargetMs: 1250 }, when: (h) => h >= 20 || h < 4, whenLabel: "night (20-4h)" },
];

export const FISH: FishDef[] = [...CORE_FISH, ...EXTRA_FISH, ...SEA_CREATURES];

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
  seaking: { develop: 1200, hold: 5200, confetti: 4, shake: 0.07 },
};

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
