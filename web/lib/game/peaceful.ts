/**
 * Peaceful loop rules (specs/peaceful-loop.md): fish pools by water type and
 * rod, bug sneak-and-swing, hourly personal respawn for foraging nodes and
 * bugs, and the museum curator's lines. Pure functions; the world wires them.
 */
import { FISH, fishingPool, type FishDef, type FishingContext } from "./fishing";
import { canHook, castLuck, type RodTier } from "./rods";
import type { WaterType } from "./fishingSpots";
import { fnv1a } from "./weatherSystem";
import { torontoParts } from "@/lib/time";
import { ROSTER, RARITY_RANK, type Biome, type Rarity, type Species } from "@/lib/collections/roster";
import { availableAt, type WorldMoment } from "@/lib/collections/logic";

// ── Fishing ────────────────────────────────────────────────────────────────

const ROSTER_BIOME = new Map(ROSTER.map(s => [s.key, s.biome]));

/** Weighted pool for a spot: water type picks the species, the rod gates legendaries and adds luck. */
export function fishPoolFor(water: WaterType, luck: number, rod: RodTier, context: FishingContext) {
  const base = fishingPool(castLuck(luck, rod), water === "sea" ? "sea" : "river", context).filter(({ fish }) => canHook(fish.rarity, rod));
  if (water === "sea") return base;
  // Pond vs river: species whose roster habitat is the pond only bite in ponds, and vice versa.
  const match = base.filter(({ fish }) => (ROSTER_BIOME.get(fish.key) === "pond") === (water === "pond"));
  return match.length ? match : base;
}

export function rollFishFor(water: WaterType, luck: number, rod: RodTier, context: FishingContext, random = Math.random): FishDef {
  const pool = fishPoolFor(water, luck, rod, context);
  if (!pool.length) return FISH[0];
  let r = random() * pool.reduce((s, e) => s + e.weight, 0);
  for (const { fish, weight } of pool) { r -= weight; if (r <= 0) return fish; }
  return pool[pool.length - 1].fish;
}

/** The one-liner for the catch card, from the shared roster. */
export function oneLinerFor(key: string): string {
  return ROSTER.find(s => s.key === key)?.oneLiner ?? "";
}

// ── Bugs: sneak and swing (decision 197) ───────────────────────────────────

/** Walking slower than this (world units/s) counts as sneaking: normal walk is 7.4, hold-C sneak 2.2 (PlayerAvatar). */
export const SNEAK_SPEED = 2.4;
/** Faster than a walk counts as running (sprint is 7.4 × 1.85 ≈ 13.7). */
export const RUN_SPEED = 9;
/** The net reaches this far. */
export const NET_REACH = 1.5;

/** How close you can get before a bug notices you; rarer bugs are jumpier. */
export function fleeRadius(rarity: Rarity): number {
  return 2.2 + RARITY_RANK[rarity] * 0.5;
}

/** Rare and up need the slow approach (hold C); ordinary bugs only mind running. */
export function scareSpeed(rarity: Rarity): number {
  return RARITY_RANK[rarity] >= RARITY_RANK.rare ? SNEAK_SPEED : RUN_SPEED;
}

export type BugReaction = "idle" | "wary" | "catchable" | "flee";
/**
 * Too fast inside the flee radius → it flies off (running for ordinary bugs,
 * anything above a sneak for rare ones). Inside net reach → swing. Inside the
 * flee radius otherwise → wary (it notices, stays put).
 */
export function bugReaction(distance: number, playerSpeed: number, rarity: Rarity): BugReaction {
  const radius = fleeRadius(rarity);
  if (distance > radius) return "idle";
  if (playerSpeed > scareSpeed(rarity)) return "flee";
  return distance <= NET_REACH ? "catchable" : "wary";
}

// ── Hourly personal respawn (decisions 83, 97) ─────────────────────────────

/** Toronto wall-clock hour key, e.g. "2026-09-24T14". */
export function hourKey(date: Date): string {
  return torontoParts(date).hourKey;
}
/** A harvested node or caught bug slot returns at the next real hour, for that player only. */
export function nodeAvailable(harvestedHour: string | null | undefined, now: Date): boolean {
  return !harvestedHour || harvestedHour !== hourKey(now);
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

/**
 * What a node holds this hour for this member: a random-rarity pick among the
 * roster species of its habitats that are in season and hour, deterministic
 * per (member, node, hour) so a refresh never rerolls it.
 */
export function rollNode(member: string, nodeId: string, hour: string, biomes: readonly Biome[], moment: WorldMoment, categories?: readonly Species["category"][]): Species | null {
  const pool = ROSTER.filter(s => biomes.includes(s.biome) && s.tool !== "rod" && (!categories || categories.includes(s.category)) && availableAt(s, moment));
  if (!pool.length) return null;
  const total = pool.reduce((s, sp) => s + RARITY_WEIGHT[sp.rarity], 0);
  let r = (fnv1a(`${member}:${nodeId}:${hour}`) / 4294967296) * total;
  for (const sp of pool) { r -= RARITY_WEIGHT[sp.rarity]; if (r <= 0) return sp; }
  return pool[pool.length - 1];
}
/** Rare finds get a diegetic tell (sparkle, rustle, chime). */
export function hasClue(sp: Pick<Species, "rarity"> | null): boolean {
  return !!sp && RARITY_RANK[sp.rarity] >= RARITY_RANK.rare;
}

// ── Museum curator (decisions 67, 202) ─────────────────────────────────────

export function curatorLine(result: { ok: true; name: string } | { ok: false; code?: string; error?: string }): string {
  if (result.ok) return `Oh, a ${result.name}! It goes on display at once, with your name on the plaque.`;
  switch (result.code) {
    case "already_donated": return `Hoo, we already have one of those. ${result.error ?? ""}`.trim();
    case "not_owned": return "You'll need one in your pockets before I can take it.";
    case "not_donatable": return "Lovely, but that's not something the museum collects.";
    default: return result.error ?? "The museum couldn't take that just now. Try again in a moment.";
  }
}
