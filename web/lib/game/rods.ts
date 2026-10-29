/**
 * Fishing rods and their add-ons (decisions 193, 94; David 2026-10-27, v1-gameplay m4 and x-shop): five launch rods,
 * each with six stats on a 0-10 scale (the shop's hex radar), and add-on slots for bait and a bobber whose gains
 * stack on the rod's stats. Every stat is a real effect inside the cast/bite/reel loop (`effects`). Legendary and up
 * need tier 4+. Tiers 2-3 are shop rods (lib/wallet/catalogue.ts); 4-5 are crafted (lib/crafting/recipes.ts).
 * The server rolls a cast with the held rod plus the equipped add-ons the member owns (lib/collections/service.ts).
 */
import { RARITY_RANK, type Rarity } from "@/lib/rarity";

export const STAT_KEYS = ["luck", "bite", "strength", "reel", "lure", "control"] as const;
export type RodStat = (typeof STAT_KEYS)[number];
export type Stats = Record<RodStat, number>;
/** The radar's outer ring. Launch rods top out well inside it: more rods come later. */
export const STAT_MAX = 10;
/** Each stat's name and what it does, for the radar and the shop. */
export const STAT_INFO: Record<RodStat, { label: string; does: string }> = {
  luck: { label: "Luck", does: "Rarer fish bite more often." },
  bite: { label: "Bite window", does: "More time to hook a bite after the !" },
  strength: { label: "Line strength", does: "The catch meter drains slower when the fish slips out of the bar." },
  reel: { label: "Reel speed", does: "The catch meter fills faster while the fish is in the bar." },
  lure: { label: "Lure", does: "Fish bite sooner after the cast." },
  control: { label: "Control", does: "A wider catch bar." },
};

/** The stats as the fishing loop uses them. Stat 1 is the starter rod's, which changes nothing. */
export interface RodEffects {
  /** Extra ms on the hook window. */
  biteWindowMs: number;
  /** Multiplier on the meter drain while the fish is outside the bar (<1 = more forgiving). */
  tensionMul: number;
  /** Added to cast luck for rare-and-up weighting. */
  rarityBonus: number;
  /** Multiplier on the meter fill while the fish is inside the bar. */
  fillMul: number;
  /** Multiplier on the wait before a bite. */
  waitMul: number;
  /** Multiplier on the catch bar's width. */
  barMul: number;
}
export function effects(s: Stats): RodEffects {
  return {
    rarityBonus: 0.04 * (s.luck - 1),
    biteWindowMs: 150 * (s.bite - 1),
    tensionMul: 1 - 0.05 * (s.strength - 1),
    fillMul: 1 + 0.05 * (s.reel - 1),
    waitMul: 1 - 0.05 * (s.lure - 1),
    barMul: 1 + 0.04 * (s.control - 1),
  };
}

export interface RodTier extends RodEffects {
  tier: 1 | 2 | 3 | 4 | 5;
  key: string;
  name: string;
  source: "starter" | "shop" | "crafted";
  /** The rod's own stats. */
  base: Stats;
  /** With the add-ons on it (`rig`); the base alone otherwise. */
  stats: Stats;
  /** The add-ons on it (TACKLE keys). */
  tackle: readonly string[];
}

const stats = (luck: number, bite: number, strength: number, reel: number, lure: number, control: number): Stats => ({ luck, bite, strength, reel, lure, control });
const rod = (tier: RodTier["tier"], key: string, name: string, source: RodTier["source"], base: Stats): RodTier =>
  ({ tier, key, name, source, base, stats: base, tackle: [], ...effects(base) });

export const RODS: readonly RodTier[] = [
  rod(1, "rod_flimsy", "Flimsy rod", "starter", stats(1, 1, 1, 1, 1, 1)),
  rod(2, "rod_cedar", "Cedar rod", "shop", stats(3, 3, 2, 2, 3, 2)),
  rod(3, "rod_glass", "Glass rod", "shop", stats(4, 4, 3, 4, 3, 5)),
  rod(4, "rod_lighthouse", "Lighthouse rod", "crafted", stats(5, 6, 5, 5, 5, 4)),
  rod(5, "rod_tidewarden", "Tidewarden rod", "crafted", stats(7, 8, 7, 6, 6, 6)),
];
/** Epic and up (the old legendary tier, now epic) bite only for rod tier 4 and 5. */
export const TOP_FISH_ROD_TIER = 4;

/** Add-on slots on every rod (more kinds later). */
export const SLOTS = ["bait", "bobber"] as const;
export type TackleSlot = (typeof SLOTS)[number];
export interface Tackle { key: string; name: string; slot: TackleSlot; gains: Partial<Stats> }
/** The add-ons: owned items (catalogue_ref = key), equipped one per slot (member_inventory.equipped). */
export const TACKLE: readonly Tackle[] = [
  { key: "bait_sweet", name: "Sweet bait", slot: "bait", gains: { bite: 2, lure: 1 } },
  { key: "bobber_lucky", name: "Lucky bobber", slot: "bobber", gains: { luck: 2 } },
];
export const tackleByKey = (key: unknown): Tackle | null => TACKLE.find(t => t.key === key) ?? null;

/** A rod with add-ons on it: known keys only, the first per slot; stats capped at STAT_MAX. */
export function rig(r: RodTier, tackleKeys: readonly unknown[] = []): RodTier {
  const on: Tackle[] = [];
  for (const k of tackleKeys) { const t = tackleByKey(k); if (t && !on.some(o => o.slot === t.slot)) on.push(t); }
  const s = { ...r.base };
  for (const t of on) for (const k of STAT_KEYS) s[k] = Math.min(STAT_MAX, s[k] + (t.gains[k] ?? 0));
  return { ...r, stats: s, tackle: on.map(t => t.key), ...effects(s) };
}

/** The rod a cast rolls with on the server: the held tier, with only the add-ons the member owns. */
export const ownedRig = (tier: number, tackle: readonly string[], owned: readonly string[]) => rig(rodByTier(tier), tackle.filter(k => owned.includes(k)));

export function rodByTier(tier: number): RodTier {
  return RODS[Math.min(RODS.length, Math.max(1, Math.round(tier))) - 1];
}
/** Best rod among owned gear keys (inventory `catalogue_ref`s; starter rod always owned). Tiers 4–5 are owned only by crafting them. */
export function bestOwnedRod(owned: readonly string[]): RodTier {
  return [...RODS].reverse().find(r => r.source === "starter" || owned.includes(r.key)) ?? RODS[0];
}
export function biteWindowMs(baseMs: number, r: RodEffects): number {
  return baseMs + r.biteWindowMs;
}
export function castLuck(luck: number, r: RodEffects): number {
  return luck + r.rarityBonus;
}
/** Epic and up only bite for top rods. */
export function canHook(rarity: Rarity, r: Pick<RodTier, "tier">): boolean {
  return RARITY_RANK[rarity] < RARITY_RANK.epic || r.tier >= TOP_FISH_ROD_TIER;
}
