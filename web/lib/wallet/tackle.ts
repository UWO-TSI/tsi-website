/**
 * The tackle shop's rolls (David, 2026-10-28: "the tackle shop should be like a gatcha roll for parts thing one for coin
 * one for gem, roll for 1 to 10, seasonal crazy bait and rod"): two counters, one paid in coins and one in Gems, each 1
 * or 10 pulls at a time; each pull gives one bait, bobber or rod. A season's "crazy" bait and rod roll only in their
 * season. The server rolls (`rollTackle`, with a secure random) and tackle_roll charges, grants and records each roll
 * once per key; the odds shown on the counter are `odds()`, the same table the roll uses.
 *
 * Prizes mirror lib/game/rods.ts on game/rod-gear (TACKLE: `key`, `name`, `slot` "bait" | "bobber", `gains`:
 * Partial<Stats>; rods: `base`: Stats) so they plug into its add-on slots at merge. Their art waits for David's
 * references (specs/design-bible.md Models): every `icon` is a stand-in until then, and the counter says so.
 */
import type { Rarity } from "@/lib/rarity";
import type { Season } from "@/lib/game/season";
import { iconUrl } from "@/lib/icons/keys";
import type { Slot } from "./catalogue";
import type { ShopItem } from "./rules";

/** rod-gear's stat keys (lib/game/rods.ts STAT_KEYS on game/rod-gear). */
export type RodStat = "luck" | "bite" | "strength" | "reel" | "lure" | "control";
export type TackleSlot = "bait" | "bobber" | "rod";
export interface TacklePrize {
  /** The item's catalogue_ref and shop_items slug (tackle_roll grants it). */
  key: string;
  name: string;
  slot: TackleSlot;
  rarity: Rarity;
  /** What it adds to the rod (rod-gear's TACKLE gains); a rod's own stats are `base`. */
  gains: Partial<Record<RodStat, number>>;
  base?: Record<RodStat, number>;
  /** Only rolls in this season (a "crazy" one). */
  season?: Season;
  /** The one plain line a hover shows. */
  does: string;
  /** A stand-in picture until its model is made (lib/icons key). */
  icon: string;
}

const rodStats = (luck: number, bite: number, strength: number, reel: number, lure: number, control: number) => ({ luck, bite, strength, reel, lure, control });

export const TACKLE_PRIZES: readonly TacklePrize[] = [
  { key: "bait_worm", name: "Sea worm", slot: "bait", rarity: "common", gains: { lure: 1 }, does: "Fish bite a little sooner.", icon: "bug_bagworm" },
  { key: "bait_clam", name: "Clam bait", slot: "bait", rarity: "common", gains: { bite: 1 }, does: "A little more time to hook a bite.", icon: "shell_asari" },
  { key: "bobber_cork", name: "Cork bobber", slot: "bobber", rarity: "common", gains: { control: 1 }, does: "A slightly wider catch bar.", icon: "bobber-lucky" },
  { key: "bait_shrimp", name: "Shrimp bait", slot: "bait", rarity: "uncommon", gains: { lure: 1, bite: 1 }, does: "Bites come sooner and stay longer.", icon: "sea_sweet_shrimp" },
  { key: "bobber_float", name: "Striped float", slot: "bobber", rarity: "uncommon", gains: { bite: 1, control: 1 }, does: "Easier to hook and to hold.", icon: "bobber-lucky" },
  { key: "bait_glow_grub", name: "Glow grub", slot: "bait", rarity: "rare", gains: { luck: 1, lure: 2 }, does: "Rarer fish come to the light.", icon: "bug_firefly" },
  { key: "bobber_brass", name: "Brass bobber", slot: "bobber", rarity: "rare", gains: { strength: 2 }, does: "The line holds when a fish pulls.", icon: "bobber-lucky" },
  { key: "bait_squid_jig", name: "Squid jig", slot: "bait", rarity: "epic", gains: { luck: 2, lure: 1, bite: 1 }, does: "Big, rare fish can't resist it.", icon: "sea_firefly_squid" },
  { key: "bobber_pearl", name: "Pearl bobber", slot: "bobber", rarity: "epic", gains: { luck: 2, control: 1 }, does: "Luckier casts and a steadier bar.", icon: "bobber-lucky" },
  // The seasons' crazy ones (legendary): a bait and a rod each, rolling only in their season.
  { key: "bait_candy_corn", name: "Candy corn bait", slot: "bait", rarity: "legendary", season: "autumn", gains: { luck: 3, lure: 2 }, does: "Autumn only. Fish go wild for it.", icon: "treat_candy_corn" },
  { key: "rod_pumpkin", name: "Pumpkin rod", slot: "rod", rarity: "legendary", season: "autumn", gains: {}, base: rodStats(6, 5, 5, 5, 6, 5), does: "Autumn only. A whole rod, and a lucky one.", icon: "rod_cedar" },
  { key: "bait_snowflake", name: "Snowflake jig", slot: "bait", rarity: "legendary", season: "winter", gains: { luck: 2, bite: 3 }, does: "Winter only. Bites wait for you.", icon: "rock_crystal" },
  { key: "rod_icicle", name: "Icicle rod", slot: "rod", rarity: "legendary", season: "winter", gains: {}, base: rodStats(5, 7, 5, 5, 5, 5), does: "Winter only. A whole rod with a long bite window.", icon: "rod_glass" },
  { key: "bait_blossom", name: "Blossom fly", slot: "bait", rarity: "legendary", season: "spring", gains: { luck: 2, lure: 3 }, does: "Spring only. Fish rise for it at once.", icon: "flower_cosmos" },
  { key: "rod_bamboo", name: "Bamboo shoot rod", slot: "rod", rarity: "legendary", season: "spring", gains: {}, base: rodStats(5, 5, 5, 6, 7, 5), does: "Spring only. A whole rod that lures fish in.", icon: "rod_cedar" },
  { key: "bait_firefly", name: "Firefly lure", slot: "bait", rarity: "legendary", season: "summer", gains: { luck: 3, control: 2 }, does: "Summer only. Lights up the rarest fish.", icon: "bug_firefly" },
  { key: "rod_sunburst", name: "Sunburst rod", slot: "rod", rarity: "legendary", season: "summer", gains: {}, base: rodStats(6, 5, 6, 6, 5, 6), does: "Summer only. A whole rod, strong and bright.", icon: "rod_glass" },
];
export const prizeByKey = (key: string) => TACKLE_PRIZES.find((p) => p.key === key) ?? null;

export type Counter = "coins" | "gems";
/**
 * Each counter's price a pull (10 pulls for the price of 9) and its chance of each rarity, in percent. The Gem counter
 * skips the commons and is likelier to give the season's crazy ones.
 */
export const TACKLE_COUNTERS: Record<Counter, { each: number; ten: number; chances: Partial<Record<Rarity, number>> }> = {
  coins: { each: 150, ten: 1350, chances: { common: 60, uncommon: 28, rare: 9, epic: 2.5, legendary: 0.5 } },
  gems: { each: 5, ten: 45, chances: { uncommon: 50, rare: 32, epic: 14, legendary: 4 } },
};
export const PULLS = [1, 10] as const;
export type Pulls = (typeof PULLS)[number];
export const rollCost = (counter: Counter, pulls: Pulls) => (pulls === 10 ? TACKLE_COUNTERS[counter].ten : TACKLE_COUNTERS[counter].each);

/** What can roll at a counter in a season, each with its chance in percent (a rarity's chance shared evenly by its prizes). */
export function odds(counter: Counter, season: Season): { prize: TacklePrize; chance: number }[] {
  const chances = TACKLE_COUNTERS[counter].chances;
  const pool = TACKLE_PRIZES.filter((p) => chances[p.rarity] && (!p.season || p.season === season));
  return pool.map((prize) => ({ prize, chance: chances[prize.rarity]! / pool.filter((p) => p.rarity === prize.rarity).length }));
}

/** `pulls` prizes from a counter's odds; `random` in [0, 1) (the server's is crypto-backed). */
export function rollTackle(counter: Counter, season: Season, pulls: Pulls, random: () => number): TacklePrize[] {
  const table = odds(counter, season), total = table.reduce((s, o) => s + o.chance, 0);
  return Array.from({ length: pulls }, () => {
    let r = random() * total;
    for (const o of table) if ((r -= o.chance) < 0) return o.prize;
    return table[table.length - 1].prize;
  });
}

/** A uniform [0, 1) from the platform's secure random. */
export function secureRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

/**
 * The prizes as the shop's rows (tackle_roll's migration seeds the same): off sale, stacking, in their slot (rod-gear
 * widens `Slot` with bait and bobber), valued in coins by rarity (shop_items needs one price; nothing sells them), so
 * the bag shows them and the shop doesn't sell them.
 */
const VALUE: Partial<Record<Rarity, number>> = { common: 50, uncommon: 150, rare: 400, epic: 1000, legendary: 2500 };
export const prizeItems = (): ShopItem[] => TACKLE_PRIZES.map((p, i) => ({
  id: `00000000-0000-4000-8000-0000007ac${String(i + 1).padStart(3, "0")}`, slug: p.key, display_name: p.name, category: "tool", description: p.does,
  price_coins: VALUE[p.rarity] ?? null, price_gems: null, tier: null, slot: p.slot as Slot, special_pool: false, stackable: true, stock: null, catalogue_ref: p.key,
  sprite_url: iconUrl(p.icon), position: 9000 + i, active: false, available_from: null, available_until: null,
}));
