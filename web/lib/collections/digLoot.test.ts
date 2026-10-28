import { describe, expect, it } from "vitest";
import { BROKEN_SUDO, DIG_COINS, SHOVEL_ODDS, digOdds, digRoll, relicsOf } from "./digLoot";
import { BURIED_FINDS } from "./roster";

/** A seeded random (mulberry32), so the tallies are the same every run. */
function seeded(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe("dig loot (David 2026-10-28: relics, coins, ores, very rarely gems, very very rarely a broken sudo)", () => {
  it("every tier's odds add up, gems stay very low and the sudo far rarer, and a better shovel does better", () => {
    for (const t of [1, 2, 3, 4, 5]) {
      const o = digOdds(t);
      expect(o.relic + o.coins + o.ore + o.gem + o.sudo).toBeCloseTo(1, 10);
      expect(o.gem).toBeLessThanOrEqual(0.01);
      expect(o.sudo).toBeLessThan(o.gem / 5);
      if (t > 1) for (const k of ["relic", "ore", "gem", "sudo"] as const) expect(o[k]).toBeGreaterThan(SHOVEL_ODDS[(t - 1) as 1][k]);
    }
  });

  it("rolls each kind at about its odds, relics from the right surface, coins in range", () => {
    const n = 60_000, random = seeded(7), seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const soil = i % 2 === 0, l = digRoll(BURIED_FINDS, soil, 1, random);
      seen[l.kind] = (seen[l.kind] ?? 0) + 1;
      if (l.kind === "relic") expect(relicsOf(BURIED_FINDS, soil).map(s => s.key)).toContain(l.key);
      if (l.kind === "coins") { expect(l.amount).toBeGreaterThanOrEqual(DIG_COINS[0]); expect(l.amount).toBeLessThanOrEqual(DIG_COINS[1]); }
      if (l.kind === "ore") expect(["rock_iron_nugget", "rock_gold_nugget"]).toContain(l.key);
    }
    const o = digOdds(1);
    for (const k of ["relic", "coins", "ore"] as const) expect(seen[k] / n).toBeCloseTo(o[k], 2);
    expect(seen.gem / n).toBeGreaterThan(o.gem * 0.7);
    expect(seen.gem / n).toBeLessThan(o.gem * 1.3);
  });

  it("the broken sudo is a real buried find the roll can land, and never a relic", () => {
    expect(BURIED_FINDS.map(s => s.key)).toContain(BROKEN_SUDO);
    expect([...relicsOf(BURIED_FINDS, true), ...relicsOf(BURIED_FINDS, false)].map(s => s.key)).not.toContain(BROKEN_SUDO);
    expect(digRoll(BURIED_FINDS, true, 1, () => 0)).toEqual({ kind: "sudo", key: BROKEN_SUDO });
    expect(digRoll(BURIED_FINDS, true, 1, () => 0.0002 + 0.001)).toEqual({ kind: "gem", amount: 1 });
  });
});
