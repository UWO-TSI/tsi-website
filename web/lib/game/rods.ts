/**
 * Fishing rods (decisions 193, 94): five tiers as data, applied inside the
 * existing cast/bite/reel loop. Each tier widens the bite window, slows how
 * fast the catch meter drains when the fish slips out ("line tension"), and
 * adds a small rare-catch bonus. Legendary fish need tier 4+. Tiers 2–3 are
 * shop rods (lib/wallet/catalogue.ts); 4–5 are crafted (crafting UI later).
 */
import type { Rarity } from "./fishing";

export interface RodTier {
  tier: 1 | 2 | 3 | 4 | 5;
  key: string;
  name: string;
  /** Extra ms on the hook window. */
  biteWindowMs: number;
  /** Multiplier on the meter drain while the fish is outside the bar (<1 = more forgiving). */
  tensionMul: number;
  /** Added to cast luck for rare-and-up weighting. */
  rarityBonus: number;
  source: "starter" | "shop" | "crafted";
}

export const RODS: readonly RodTier[] = [
  { tier: 1, key: "rod_flimsy", name: "Flimsy rod", biteWindowMs: 0, tensionMul: 1, rarityBonus: 0, source: "starter" },
  { tier: 2, key: "rod_cedar", name: "Cedar rod", biteWindowMs: 250, tensionMul: 0.92, rarityBonus: 0.05, source: "shop" },
  { tier: 3, key: "rod_glass", name: "Glass rod", biteWindowMs: 500, tensionMul: 0.84, rarityBonus: 0.1, source: "shop" },
  { tier: 4, key: "rod_lighthouse", name: "Lighthouse rod", biteWindowMs: 800, tensionMul: 0.76, rarityBonus: 0.18, source: "crafted" },
  { tier: 5, key: "rod_tidewarden", name: "Tidewarden rod", biteWindowMs: 1100, tensionMul: 0.68, rarityBonus: 0.25, source: "crafted" },
];
export const LEGENDARY_ROD_TIER = 4;

export function rodByTier(tier: number): RodTier {
  return RODS[Math.min(RODS.length, Math.max(1, Math.round(tier))) - 1];
}
/** Best rod among owned gear keys (starter rod always owned). Crafted tiers 4–5 stay dev-only (`?rod=`) until crafting exists. */
export function bestOwnedRod(owned: readonly string[]): RodTier {
  return [...RODS].reverse().find(rod => rod.source === "starter" || (rod.source === "shop" && owned.includes(rod.key))) ?? RODS[0];
}
export function biteWindowMs(baseMs: number, rod: RodTier): number {
  return baseMs + rod.biteWindowMs;
}
export function castLuck(luck: number, rod: RodTier): number {
  return luck + rod.rarityBonus;
}
/** Legendary (and sea-king) species only bite for top rods. */
export function canHook(rarity: Rarity, rod: RodTier): boolean {
  return (rarity !== "legendary" && rarity !== "seaking") || rod.tier >= LEGENDARY_ROD_TIER;
}
