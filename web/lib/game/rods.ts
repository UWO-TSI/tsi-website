/**
 * Fishing rods and their add-ons (decisions 193, 94; David 2026-10-27, v1-gameplay m4 and x-shop): the rods, each with
 * a rarity and six stats graded out of 100 (the hex radar), and add-on slots for bait and a bobber whose gains stack on
 * the rod's stats. Every stat is a real effect inside the cast/bite/reel loop (`effects`). The rod's rarity caps the
 * fish it hooks (`hookCap`, David 2026-10-28). Shop rods are lib/wallet/catalogue.ts, crafted ones lib/crafting/recipes.ts;
 * the Training rod is found, never sold (`TRAINING`, David 2026-11-02), and grows with the fish it lands (`trained`).
 * Every landed cast counts toward its rod (rod_catches, 20261102170000_rod_catches.sql).
 * The server rolls a cast with the held rod plus the equipped add-ons the member owns (lib/collections/service.ts).
 */
import { OBTAINABLE, RARITY_RANK, type Rarity } from "@/lib/rarity";

export const STAT_KEYS = ["luck", "bite", "strength", "reel", "lure", "control"] as const;
export type RodStat = (typeof STAT_KEYS)[number];
export type Stats = Record<RodStat, number>;
/** Stats are graded out of 100 (David 2026-10-28). Launch rods top out well inside it: more rods come later. */
export const STAT_MAX = 100;
/** Each stat's name and what it does, for the radar and the shop. */
export const STAT_INFO: Record<RodStat, { label: string; does: string }> = {
  luck: { label: "Luck", does: "Rarer fish bite more often." },
  bite: { label: "Bite window", does: "More time to hook a bite after the !" },
  strength: { label: "Line strength", does: "The catch meter drains slower when the fish slips out of the bar." },
  reel: { label: "Reel speed", does: "The catch meter fills faster while the fish is in the bar." },
  lure: { label: "Lure", does: "Fish bite sooner after the cast." },
  control: { label: "Control", does: "A wider catch bar." },
};

/** The stats as the fishing loop uses them. 10 is the starter rod's, which changes nothing; each 10 is one step. */
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
  const step = (v: number) => (v - 10) / 10;
  return {
    rarityBonus: 0.04 * step(s.luck),
    biteWindowMs: 150 * step(s.bite),
    tensionMul: 1 - 0.05 * step(s.strength),
    fillMul: 1 + 0.05 * step(s.reel),
    waitMul: 1 - 0.05 * step(s.lure),
    barMul: 1 + 0.04 * step(s.control),
  };
}

export interface RodTier extends RodEffects {
  /** Its tool tier (the wheel's "Tier n"); several rods can share one. */
  tier: 1 | 2 | 3 | 4 | 5;
  key: string;
  name: string;
  /** Its rung on the ladder: the shop card's outline and the fish it can hook (`hookCap`). */
  rarity: Rarity;
  /** `found`: never sold or crafted; the shop shows it only to its owner. */
  source: "starter" | "shop" | "crafted" | "found";
  /** The rod's own stats. */
  base: Stats;
  /** With the add-ons on it (`rig`); the base alone otherwise. */
  stats: Stats;
  /** The add-ons on it (TACKLE keys). */
  tackle: readonly string[];
}

const stats = (luck: number, bite: number, strength: number, reel: number, lure: number, control: number): Stats => ({ luck, bite, strength, reel, lure, control });
const rod = (tier: RodTier["tier"], key: string, name: string, rarity: Rarity, source: RodTier["source"], base: Stats): RodTier =>
  ({ tier, key, name, rarity, source, base, stats: base, tackle: [], ...effects(base) });

/** Weakest to strongest: the wheel's default is the last one owned (`bestOwnedRod`), and the last hooks the most. */
export const RODS: readonly RodTier[] = [
  rod(1, "rod_flimsy", "Flimsy rod", "common", "starter", stats(10, 10, 10, 10, 10, 10)),
  rod(1, "rod_precision", "Precision rod", "common", "shop", stats(15, 30, 15, 15, 15, 35)),
  rod(2, "rod_cedar", "Cedar rod", "uncommon", "shop", stats(30, 30, 20, 20, 30, 20)),
  rod(2, "rod_carrot", "Carrot rod", "uncommon", "shop", stats(35, 25, 25, 25, 40, 20)),
  rod(2, "rod_training", "Training rod", "common", "found", stats(30, 40, 30, 35, 30, 40)),
  rod(3, "rod_glass", "Glass rod", "rare", "shop", stats(40, 40, 30, 40, 30, 50)),
  rod(4, "rod_lighthouse", "Lighthouse rod", "rare", "crafted", stats(50, 60, 50, 50, 50, 40)),
  rod(5, "rod_tidewarden", "Tidewarden rod", "epic", "crafted", stats(70, 80, 70, 60, 60, 60)),
];
/**
 * tool-pipeline is modelling David's round-4 rods (tools/rod-precision.glb, rod-carrot.glb, rod-training.glb). Until
 * each lands, it wears this older rod's model and icon (lib/game/tools.ts, lib/icons/keys.ts): delete its line then.
 */
export const STAND_IN: Readonly<Record<string, string>> = { rod_precision: "rod_flimsy", rod_carrot: "rod_cedar", rod_training: "rod_glass" };

/**
 * The Training rod (David 2026-11-02: "easter egg to unlock and not a common rod you can buy ... very good stats
 * comparable to uncommon rare, one of best starter rods and it has upgrade potential"). Nobody sells it: the
 * `unlock.catches`th fish landed with the `unlock.rod` finds it (the server grants it in collections_land, which
 * repeats these numbers; rods.test.ts checks they match). It trains with use: each of `levels` fish landed with it
 * adds `step` to every stat.
 */
export const TRAINING = { key: "rod_training", unlock: { rod: "rod_flimsy", catches: 50 }, levels: [25, 75, 150], step: 5 } as const;
/** The Training rod's level for the fish landed with it (0 to 3). */
export const trainingLevel = (catches: number) => TRAINING.levels.filter(n => catches >= n).length;
/** Fish still to land for its next level, or null at the top. */
export const toNextLevel = (catches: number) => TRAINING.levels.find(n => catches < n) ?? null;
/** A rod as it is after `catches` fish: the Training rod's stats grow; every other rod's stay. */
export function trained(r: RodTier, catches = 0): RodTier {
  if (r.key !== TRAINING.key) return r;
  const up = TRAINING.step * trainingLevel(catches), base = { ...r.base };
  for (const k of STAT_KEYS) base[k] = Math.min(STAT_MAX, base[k] + up);
  return { ...r, base, stats: base, ...effects(base) };
}

/**
 * The rarest fish a rod hooks: one rung above its own (David 2026-10-28: a rare rod hooks up to epic, an epic rod up to
 * legendary, a legendary rod up to divine; the coordinator applied the pattern down the ladder). Divine is the top.
 * The server rolls with the same rule (peaceful.ts via lib/collections/rolls.ts).
 */
export const hookCap = (rod: Rarity): Rarity => OBTAINABLE[Math.min(OBTAINABLE.indexOf(rod === "contraband" ? "divine" : rod) + 1, OBTAINABLE.length - 1)];
/** The shop's rods go up to rare for now (legendary fish aren't out yet); rarer rods stay off its shelf. */
export const SHOP_ROD_MAX: Rarity = "rare";
export const onShopShelf = (r: Pick<RodTier, "rarity">) => RARITY_RANK[r.rarity] <= RARITY_RANK[SHOP_ROD_MAX];

/** Add-on slots on every rod (more kinds later). */
export const SLOTS = ["bait", "bobber"] as const;
export type TackleSlot = (typeof SLOTS)[number];
/** `model` is the close-up (high-def) file; the rod wears its low-poly copy (`worldModel`, lib/game/world/active.ts). */
export interface Tackle { key: string; name: string; slot: TackleSlot; gains: Partial<Stats>; model: string }
/** The add-ons: owned items (catalogue_ref = key), equipped one per slot (member_inventory.equipped). */
export const TACKLE: readonly Tackle[] = [
  { key: "bait_sweet", name: "Sweet bait", slot: "bait", gains: { bite: 20, lure: 10 }, model: "/assets/game/items/bait-sweet.glb" },
  { key: "bobber_lucky", name: "Lucky bobber", slot: "bobber", gains: { luck: 20 }, model: "/assets/game/items/bobber-lucky.glb" },
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

/** The held rod (by key) as trained by `catches` (rod key: fish landed with it), with the add-ons `tackle`. */
export const heldRig = (key: string, tackle: readonly string[], catches: Readonly<Record<string, number>> = {}) =>
  rig(trained(rodByKey(key) ?? RODS[0], catches[key] ?? 0), tackle);
/** The rod a cast rolls with on the server: the held rod, trained, with only the add-ons the member owns. */
export const ownedRig = (key: string, tackle: readonly string[], owned: readonly string[], catches: Readonly<Record<string, number>> = {}) =>
  heldRig(key, tackle.filter(k => owned.includes(k)), catches);

export const rodByKey = (key: unknown): RodTier | null => RODS.find(r => r.key === key) ?? null;
/** The first rod of a tool tier (1 to 5). */
export function rodByTier(tier: number): RodTier {
  const t = Math.min(5, Math.max(1, Math.round(tier)));
  return RODS.find(r => r.tier === t)!;
}
/** Best rod among owned gear keys (inventory `catalogue_ref`s; starter rod always owned). Crafted and found rods are owned only once made or found. */
export function bestOwnedRod(owned: readonly string[]): RodTier {
  return [...RODS].reverse().find(r => r.source === "starter" || owned.includes(r.key)) ?? RODS[0];
}
export function biteWindowMs(baseMs: number, r: RodEffects): number {
  return baseMs + r.biteWindowMs;
}
export function castLuck(luck: number, r: RodEffects): number {
  return luck + r.rarityBonus;
}
/** Whether a fish of this rarity can bite for this rod (`hookCap`). */
export function canHook(rarity: Rarity, r: Pick<RodTier, "rarity">): boolean {
  return RARITY_RANK[rarity] <= RARITY_RANK[hookCap(r.rarity)];
}
