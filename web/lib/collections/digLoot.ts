/**
 * What a dig spot gives (m3; David 2026-10-28: "burried find should drop like relics for museum, coins, ores, very
 * rarely gems and veryveryvery rare is a broken sudo. and you can upgrade shovel for differnt loot chances"). The
 * server rolls it (lib/collections/service.ts catchAction) with the held shovel's tier, as a cast rolls with the held
 * rod's (lib/game/rods.ts): the tier is data, the odds are this table. Pure.
 *
 * Gems are the premium currency: their odds stay very low at every tier.
 */
import { RARITY_RANK, type Rarity, type Species } from "./roster";

export type DigKind = "relic" | "coins" | "ore" | "gem" | "sudo";
export type DigLoot =
  | { kind: "relic" | "ore" | "sudo"; key: string }
  | { kind: "coins"; amount: number }
  | { kind: "gem"; amount: number };

/** A shovel tier's chance of each kind (coins: what's left). */
export type DigOdds = Record<Exclude<DigKind, "coins">, number>;

/** By shovel tier (lib/game/tools.ts: 1 Shovel, 2 Iron, 3 Sturdy, 4 Crystal, 5 Golden). Better shovels find more relics and ore, a little more often a gem. */
export const SHOVEL_ODDS: Readonly<Record<1 | 2 | 3 | 4 | 5, DigOdds>> = {
  1: { relic: 0.5, ore: 0.15, gem: 0.003, sudo: 0.0002 },
  2: { relic: 0.52, ore: 0.17, gem: 0.004, sudo: 0.0003 },
  3: { relic: 0.54, ore: 0.19, gem: 0.005, sudo: 0.0004 },
  4: { relic: 0.56, ore: 0.21, gem: 0.007, sudo: 0.0006 },
  5: { relic: 0.58, ore: 0.23, gem: 0.01, sudo: 0.001 },
};
export const digOdds = (tier: number): DigOdds & { coins: number } => {
  const o = SHOVEL_ODDS[Math.min(5, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4 | 5];
  return { ...o, coins: 1 - o.relic - o.ore - o.gem - o.sudo };
};

/** A purse of old coins: this many play coins, uniform. */
export const DIG_COINS: readonly [number, number] = [10, 50];
/** The ore that turns up: mostly iron, now and then gold. */
export const DIG_ORES: readonly (readonly [string, number])[] = [["rock_iron_nugget", 0.85], ["rock_gold_nugget", 0.15]];
/** The very, very rare lore find (specs/lore.md "sudo canon": a sudo is built, never given; this one never got its heart flashed). */
export const BROKEN_SUDO = "find_broken_sudo";
/** A relic's chance by rarity, among the surface's relics (as a forage node weighs them, lib/game/peaceful.ts). */
const RELIC_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1, divine: 0, contraband: 0 };

/** The museum relics of a surface (sand or dirt): its buried finds, never the sudo. */
export const relicsOf = (finds: readonly Species[], soil: boolean) =>
  finds.filter(s => s.key !== BROKEN_SUDO && s.biome === (soil ? "dig_soil" : "dig_sand"));

/** One dig: the kind by the shovel's odds, then which relic, which ore, or how many coins. */
export function digRoll(finds: readonly Species[], soil: boolean, tier: number, random: () => number = Math.random): DigLoot {
  const o = digOdds(tier);
  let r = random();
  const pick = (k: DigKind) => (r -= o[k]) < 0;
  if (pick("sudo")) return { kind: "sudo", key: BROKEN_SUDO };
  if (pick("gem")) return { kind: "gem", amount: 1 };
  if (pick("ore")) {
    let q = random();
    for (const [key, p] of DIG_ORES) if ((q -= p) < 0) return { kind: "ore", key };
    return { kind: "ore", key: DIG_ORES[0][0] };
  }
  if (pick("relic")) {
    const pool = relicsOf(finds, soil).sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]);
    let w = random() * pool.reduce((n, s) => n + RELIC_WEIGHT[s.rarity], 0);
    for (const s of pool) if ((w -= RELIC_WEIGHT[s.rarity]) < 0) return { kind: "relic", key: s.key };
    if (pool.length) return { kind: "relic", key: pool[pool.length - 1].key };
  }
  return { kind: "coins", amount: Math.round(DIG_COINS[0] + random() * (DIG_COINS[1] - DIG_COINS[0])) };
}
