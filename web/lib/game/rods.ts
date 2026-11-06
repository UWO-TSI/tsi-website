/**
 * Fishing rods and their add-ons (decisions 193, 94; David 2026-10-27, v1-gameplay m4 and x-shop): the rods, each with
 * a rarity and six stats on the hex radar (up to STAT_MAX), and add-on slots for bait and a bobber whose gains stack on
 * the rod's stats. Every stat is a real effect inside the cast/bite/reel loop (`effects`). The rod's rarity caps the
 * fish it hooks (`hookCap`, David 2026-10-28). Shop rods are lib/wallet/catalogue.ts, crafted ones lib/crafting/recipes.ts;
 * the Training rod is traded for at the tackle shop, never on the shelf (`TRAINING`). No levels: some rods awaken as they land
 * fish (`awakened`, David 2026-11-04), and rare and up carry a passive (`inPlay`). Every landed cast counts toward its
 * rod (rod_catches, 20261102170000_rod_catches.sql).
 * The server rolls a cast with the held rod plus the equipped add-ons the member owns (lib/collections/service.ts).
 */
import { OBTAINABLE, RARITY_RANK, type Rarity } from "@/lib/rarity";
import type { WaterType } from "./fishingSpots";
import type { Weather } from "./weather";
import type { TrackedQuest } from "./questTracker";

export const STAT_KEYS = ["luck", "bite", "strength", "reel", "lure", "control"] as const;
export type RodStat = (typeof STAT_KEYS)[number];
export type Stats = Record<RodStat, number>;
/**
 * The radar's outer ring and every stat's cap (David 2026-11-04): legendary rods sit about 100, Divine ones past it
 * (110 to 120), so the epics never max out early.
 */
export const STAT_MAX = 120;
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
  /** The rarest fish it hooks (`hookCap` of its rarity, unless an awakening or the rod says otherwise). */
  hooks: Rarity;
  /** Its passive (rare and up; a few have none), or null. */
  passive: Passive | null;
  /** What it becomes as it lands fish with it (epic and up, and the Training rod), first to last. */
  awakenings: readonly Awakening[];
  /** How many of them it has reached (`awakened`). */
  stage: number;
}

/** Where and when a cast is: what a passive checks. `hour` is the island's (0 to 24), `weather` the reel's. */
export interface CastScene { water: WaterType | null; hour: number; weather: string }
/** A passive: a few points on some stats while its scene holds (David 2026-11-04: "passive ability exist aswell"). */
export interface Passive {
  name: string;
  /** The card's line: what it gives and when. */
  text: string;
  gains: Partial<Stats>;
  when: { water?: readonly WaterType[]; weather?: readonly Weather[]; night?: true };
}
/**
 * An awakening (David 2026-11-04: "no levels, only awakenings for rods"): at `at` fish landed with the rod its stats
 * become `base`, it may hook rarer fish (`hooks`) and take a new passive. `looks` is the rung its stats now match, for
 * the reveal's outline. `model` is the awakened rod's own model (art/pipeline/build_rods.py), which it wears from then
 * on wherever it shows (`awakenedLook`); without one it keeps the model it was bought with.
 */
export interface Awakening { at: number; base: Stats; looks: Rarity; hooks?: Rarity; passive?: Passive; model?: string }

/**
 * The rarest fish a rod hooks: one rung above its own (David 2026-10-28: a rare rod hooks up to epic, an epic rod up to
 * legendary, a legendary rod up to divine; the coordinator applied the pattern down the ladder). Divine is the top.
 * The server rolls with the same rule (peaceful.ts via lib/collections/rolls.ts).
 */
export const hookCap = (rod: Rarity): Rarity => OBTAINABLE[Math.min(OBTAINABLE.indexOf(rod === "contraband" ? "divine" : rod) + 1, OBTAINABLE.length - 1)];
const stats = (luck: number, bite: number, strength: number, reel: number, lure: number, control: number): Stats => ({ luck, bite, strength, reel, lure, control });
/** `s` with `gains` added, capped at STAT_MAX. */
const up = (s: Stats, gains: Partial<Stats>): Stats => Object.fromEntries(STAT_KEYS.map(k => [k, Math.min(STAT_MAX, s[k] + (gains[k] ?? 0))])) as Stats;
const rod = (tier: RodTier["tier"], key: string, name: string, rarity: Rarity, source: RodTier["source"], base: Stats,
  x: { passive?: Passive; awakenings?: Awakening[]; hooks?: Rarity } = {}): RodTier =>
  ({ tier, key, name, rarity, source, base, stats: base, tackle: [], hooks: x.hooks ?? hookCap(rarity), passive: x.passive ?? null, awakenings: x.awakenings ?? [], stage: 0, ...effects(base) });
const passive = (name: string, text: string, gains: Partial<Stats>, when: Passive["when"]): Passive => ({ name, text, gains, when });

const TIDEWARDEN = stats(56, 64, 56, 50, 50, 50), TITANIUM = stats(46, 50, 68, 56, 44, 48), TEMPEST = stats(60, 52, 54, 64, 58, 46);
/** Where each epic awakens, once (David 2026-11-06: "they are all very high cap at 600 ish"). */
export const AWAKEN_AT = 600;

/**
 * Weakest to strongest (by their stats as bought): the wheel's default is the last one owned (`bestOwnedRod`). Rescaled
 * 2026-11-04 so legendary sits about 100 and Divine past it; each rod's numbers fit the rod (Glass is brittle).
 */
export const RODS: readonly RodTier[] = [
  rod(1, "rod_flimsy", "Flimsy rod", "common", "starter", stats(10, 10, 10, 10, 10, 10)),
  // The Training rod (David 2026-11-04): about the Flimsy's stats, hooking up to rare from the start; it awakens three
  // times, unannounced (its card shows only its fish count), to a rare's stats, an epic's and a legendary's.
  rod(1, "rod_training", "Training rod", "common", "found", stats(12, 12, 12, 12, 12, 12), { hooks: "rare", awakenings: [
    { at: 50, base: stats(36, 38, 32, 34, 34, 38), looks: "rare", hooks: "epic" },
    { at: 250, base: stats(58, 62, 56, 58, 56, 62), looks: "epic", hooks: "legendary" },
    { at: 1000, base: stats(96, 100, 94, 98, 96, 100), looks: "legendary", hooks: "divine",
      passive: passive("Seasoned", "+10 lure in the rain.", { lure: 10 }, { weather: ["rain"] }) },
  ] }),
  rod(1, "rod_precision", "Precision rod", "common", "shop", stats(12, 22, 12, 12, 12, 26)),
  rod(2, "rod_cedar", "Cedar rod", "uncommon", "shop", stats(22, 20, 18, 16, 22, 16)),
  rod(2, "rod_carrot", "Carrot rod", "uncommon", "shop", stats(22, 16, 18, 18, 30, 16)),
  rod(3, "rod_glass", "Glass rod", "rare", "shop", stats(36, 34, 16, 36, 30, 44),
    { passive: passive("Sunlit", "+10 control in sunny weather.", { control: 10 }, { weather: ["sunny"] }) }),
  rod(3, "rod_riptide", "Riptide rod", "rare", "crafted", stats(30, 30, 36, 42, 34, 30),
    { passive: passive("Current", "+10 reel speed in the sea.", { reel: 10 }, { water: ["sea"] }) }),
  rod(4, "rod_lighthouse", "Lighthouse rod", "rare", "crafted", stats(44, 46, 38, 36, 40, 34),
    { passive: passive("Beacon", "+10 luck after dark (8 pm to 6 am).", { luck: 10 }, { night: true }) }),
  // The epics' awakenings (David 2026-11-06, rg8-table: "tide warden titanium and tempes only have 1 awakenings, and
  // they are all very high cap at 600 ish"): one each, at 600 fish; what grows is what the rod is for.
  // Titanium: its line and its hold.
  rod(5, "rod_titanium", "Titanium rod", "epic", "crafted", TITANIUM, {
    passive: passive("Steel line", "+10 line strength in rivers and ponds.", { strength: 10 }, { water: ["river", "pond"] }),
    awakenings: [{ at: AWAKEN_AT, base: up(TITANIUM, { strength: 14, control: 6, reel: 4 }), looks: "epic", model: "/assets/game/tools/rod-titanium-a1.glb" }] }),
  // Tidewarden: the widest bite window grows wider, and its passive widens.
  rod(5, "rod_tidewarden", "Tidewarden rod", "epic", "crafted", TIDEWARDEN, {
    passive: passive("Tide keeper", "+10 line strength in the sea.", { strength: 10 }, { water: ["sea"] }),
    awakenings: [{ at: AWAKEN_AT, base: up(TIDEWARDEN, { bite: 16, luck: 12, strength: 4, lure: 8, reel: 6 }), looks: "epic",
      passive: passive("Tide keeper", "+10 line strength and +10 luck in the sea.", { strength: 10, luck: 10 }, { water: ["sea"] }) }] }),
  // Tempest: its reel and its luck, and it brings the storm in on cloud.
  rod(5, "rod_tempest", "Tempest rod", "epic", "found", TEMPEST, {
    passive: passive("Storm born", "+10 reel speed and +10 luck in the rain.", { reel: 10, luck: 10 }, { weather: ["rain"] }),
    awakenings: [{ at: AWAKEN_AT, base: up(TEMPEST, { reel: 16, lure: 6, luck: 10, control: 6 }), looks: "epic",
      passive: passive("Storm born", "+10 reel speed and +10 luck in rain or cloud.", { reel: 10, luck: 10 }, { weather: ["rain", "cloudy"] }) }] }),
];
/** The rod seller at the tackle shop (David 2026-11-04: "rod seller will be named Gary"). */
export const ROD_SELLER = "Gary";
/**
 * The Training rod (David 2026-11-04): never on the shelf. At the `quest.catches`th fish landed with the `quest.rod` a
 * quest starts: Gary trades it for your Flimsy rod (the Flimsy leaves your bag). The server repeats these numbers in
 * rod_training_trade (20261102170000_rod_catches.sql; rods.test.ts keeps them equal).
 */
export const TRAINING = { key: "rod_training", quest: { rod: "rod_flimsy", catches: 35 } } as const;
/**
 * Gary's quest for the tracker: once the Flimsy rod has landed TRAINING.quest.catches fish, until the Training rod is
 * yours. Null otherwise.
 */
export function trainingQuest(catches: Readonly<Record<string, number>>, owned: readonly string[]): TrackedQuest | null {
  const { rod, catches: need } = TRAINING.quest;
  if ((catches[rod] ?? 0) < need || owned.includes(TRAINING.key)) return null;
  return { id: "rod-seller", title: `${ROD_SELLER} wants a word`, kind: "quest", hint: "The tackle shop's counter, on the wharf",
    steps: [{ id: "fish", label: `Land ${need} fish with the Flimsy rod`, done: true }, { id: "talk", label: `Talk to ${ROD_SELLER} at the tackle shop`, done: false }] };
}
/** Whether a rod's awakenings stay a surprise (the Training rod's: its card shows only its fish count). */
export const secretAwakenings = (r: Pick<RodTier, "key">) => r.key === TRAINING.key;
/** How many awakenings a rod has reached after `catches` fish. */
export const stageAt = (r: Pick<RodTier, "awakenings">, catches: number) => r.awakenings.filter(a => catches >= a.at).length;
/** The next awakening after `catches` fish, or null (none, or all reached). */
export const nextAwakening = (r: Pick<RodTier, "awakenings">, catches: number) => r.awakenings.find(a => catches < a.at) ?? null;
/**
 * A rod as it is after `catches` fish landed with it: its last awakening's rarity (David 2026-11-04: "when awakened,
 * rarity change"), stats, hooks and passive.
 */
export function awakened(r: RodTier, catches = 0): RodTier {
  const stage = stageAt(r, catches);
  if (stage === 0) return r;
  const a = r.awakenings[stage - 1], passive = r.awakenings.slice(0, stage).reverse().find(x => x.passive)?.passive ?? r.passive;
  return { ...r, rarity: a.looks, base: a.base, stats: a.base, hooks: a.hooks ?? r.hooks, passive, stage, ...effects(a.base) };
}
/**
 * The model an awakened rod (`awakened`) wears, from its last awakening that has one, and that model's icon key
 * (`<rod key>_a<n>`); null while it wears the one it was bought with.
 */
export function awakenedLook(r: RodTier): { model: string; icon: string } | null {
  for (let n = r.stage; n > 0; n--) { const model = r.awakenings[n - 1].model; if (model) return { model, icon: `${r.key}_a${n}` }; }
  return null;
}
/** Whether a passive holds for this cast. Night is 8 pm to 6 am on the island. */
export const passiveHolds = (p: Passive, at: CastScene) =>
  (!p.when.water || (at.water !== null && p.when.water.includes(at.water))) && (!p.when.weather || (p.when.weather as readonly string[]).includes(at.weather))
  && (!p.when.night || at.hour >= 20 || at.hour < 6);
/** The rod as it fishes this cast: its passive's gains on top when the scene holds (both the server's roll and the reel). */
export function inPlay(r: RodTier, at: CastScene): RodTier {
  if (!r.passive || !passiveHolds(r.passive, at)) return r;
  const s = { ...r.stats };
  for (const k of STAT_KEYS) s[k] = Math.min(STAT_MAX, s[k] + (r.passive.gains[k] ?? 0));
  return { ...r, stats: s, ...effects(s) };
}
/** Owned gear keys own a rod: the starter is everyone's until it's traded for the Training rod. */
export const ownsRod = (r: Pick<RodTier, "key" | "source">, owned: readonly string[]) =>
  owned.includes(r.key) || (r.source === "starter" && !owned.includes(TRAINING.key));

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

/** The held rod (by key) as awakened by `catches` (rod key: fish landed with it), with the add-ons `tackle`. */
export const heldRig = (key: string, tackle: readonly string[], catches: Readonly<Record<string, number>> = {}) =>
  rig(awakened(rodByKey(key) ?? RODS[0], catches[key] ?? 0), tackle);
/** The rod a cast rolls with on the server: the held rod, awakened, with only the add-ons the member owns. */
export const ownedRig = (key: string, tackle: readonly string[], owned: readonly string[], catches: Readonly<Record<string, number>> = {}) =>
  heldRig(key, tackle.filter(k => owned.includes(k)), catches);

export const rodByKey = (key: unknown): RodTier | null => RODS.find(r => r.key === key) ?? null;
/** The first rod of a tool tier (1 to 5). */
export function rodByTier(tier: number): RodTier {
  const t = Math.min(5, Math.max(1, Math.round(tier)));
  return RODS.find(r => r.tier === t)!;
}
/** Best rod among owned gear keys (inventory `catalogue_ref`s; the starter until it's traded, `ownsRod`). */
export function bestOwnedRod(owned: readonly string[]): RodTier {
  return [...RODS].reverse().find(r => ownsRod(r, owned)) ?? RODS[0];
}
export function biteWindowMs(baseMs: number, r: RodEffects): number {
  return baseMs + r.biteWindowMs;
}
export function castLuck(luck: number, r: RodEffects): number {
  return luck + r.rarityBonus;
}
/** Whether a fish of this rarity can bite for this rod (its `hooks`). */
export function canHook(rarity: Rarity, r: Pick<RodTier, "hooks">): boolean {
  return RARITY_RANK[rarity] <= RARITY_RANK[r.hooks];
}
