import { describe, expect, it } from "vitest";
import { fishPoolFor } from "@/lib/game/peaceful";
import { rodByTier } from "@/lib/game/rods";
import { seededRandom } from "@/lib/game/weatherSystem";
import { villageNodes } from "@/lib/game/islandNodes";
import { ROSTER, type Rarity } from "./roster";
import { fishRoll, nodeRoll } from "./rolls";

const NOON = new Date("2026-09-24T16:00:00Z"); // 12:00 in Toronto
const close = (observed: number, p: number, n: number) => Math.abs(observed - p) <= 4 * Math.sqrt((p * (1 - p)) / n) + 0.002;
const tally = (keys: string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());

describe("server rolls match the tables", () => {
  it("fish: the reel's weighted pool for the water, rod, cast luck, hour and weather", () => {
    const N = 20_000, random = seededRandom(7), rod = rodByTier(3);
    const got = tally(Array.from({ length: N }, () => fishRoll("river", 1, rod, NOON, "rain", random).fish.key));
    // Max cast: luck 1 + the max-cast bonus; rain is "rain" to the reel; September.
    const pool = fishPoolFor("river", 1.3, rod, { hour: 12, weather: "rain", month: 9 });
    const total = pool.reduce((s, e) => s + e.weight, 0);
    expect([...got.keys()].every((k) => pool.some((e) => e.fish.key === k))).toBe(true);
    for (const { fish, weight } of pool) expect(close((got.get(fish.key) ?? 0) / N, weight / total, N), fish.key).toBe(true);
  });

  it("fish: only in their roster months (salmon, Sep–Nov, never bites in May)", () => {
    const keys = (iso: string) => {
      const random = seededRandom(5);
      return new Set(Array.from({ length: 6000 }, () => fishRoll("river", 1, rodByTier(3), new Date(iso), "clear", random).fish.key));
    };
    const may = keys("2026-05-15T16:00:00Z"), october = keys("2026-10-15T16:00:00Z");
    expect(may.has("fish_salmon")).toBe(false);
    expect(october.has("fish_salmon")).toBe(true);
    const outOfSeason = (month: number, got: Set<string>) => [...got].filter((k) => { const sp = ROSTER.find((s) => s.key === k); return !!sp?.months.length && !sp.months.includes(month); });
    expect(outOfSeason(5, may)).toEqual([]);
    expect(outOfSeason(10, october)).toEqual([]);
  });

  it("fish: sizes stay in the species range, skewed small", () => {
    const random = seededRandom(3);
    const rolls = Array.from({ length: 2000 }, () => fishRoll("sea", 0, rodByTier(1), NOON, "clear", random));
    for (const { fish, size } of rolls) expect(size >= fish.sizeCm[0] && size <= fish.sizeCm[1], fish.key).toBe(true);
    const share = rolls.map(({ fish, size }) => (size - fish.sizeCm[0]) / (fish.sizeCm[1] - fish.sizeCm[0]));
    expect(share.reduce((a, b) => a + b, 0) / share.length).toBeLessThan(0.45);
  });

  it("forage nodes: random rarity per member and hour by the rarity weights", () => {
    const WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
    const shell = villageNodes().forage.find((n) => n.id.startsWith("shell-"))!;
    const N = 20_000;
    const got = tally(Array.from({ length: N }, (_, i) => nodeRoll(`member-${i}`, shell, NOON, "clear")!.key));
    const pool = ROSTER.filter((s) => shell.biomes.includes(s.biome) && s.tool !== "rod" && shell.categories.includes(s.category) && (!s.months.length || s.months.includes(9)));
    const total = pool.reduce((s, sp) => s + WEIGHT[sp.rarity], 0);
    expect(pool.length).toBeGreaterThan(2);
    for (const sp of pool) expect(close((got.get(sp.key) ?? 0) / N, WEIGHT[sp.rarity] / total, N), sp.key).toBe(true);
  });

  it("a node holds the same thing for the same member all hour, and the world shows it", () => {
    const rock = villageNodes().forage.find((n) => n.id.startsWith("rock-"))!;
    const a = nodeRoll("m1", rock, NOON, "clear"), b = nodeRoll("m1", rock, new Date(NOON.getTime() + 50 * 60_000), "clear");
    expect(a?.key).toBe(b?.key);
  });
});
