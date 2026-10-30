import { describe, expect, it } from "vitest";
import worldDoc from "@/data/world/world.json";
import { fishPoolFor } from "@/lib/game/peaceful";
import { rodByTier } from "@/lib/game/rods";
import { seededRandom } from "@/lib/game/weatherSystem";
import { villageNodes } from "@/lib/game/islandNodes";
import { ROSTER, type Rarity } from "./roster";
import { activeWaters, castWater, fishRoll, nodeRoll } from "./rolls";
import { village } from "@/lib/game/villageMap";
import { TOGETHER } from "@/lib/game/fishing";

const NOON = new Date("2026-09-24T16:00:00Z"); // 12:00 in Toronto
const close = (observed: number, p: number, n: number) => Math.abs(observed - p) <= 4 * Math.sqrt((p * (1 - p)) / n) + 0.002;
const tally = (keys: string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());

describe("fishing together (s-fishtogether)", () => {
  it("rolls with a little more luck: the pool of a cast TOGETHER.luck luckier", () => {
    const rod = rodByTier(3), at = { hour: 12, weather: "clear" as const, month: 9 };
    const rare = (luck: number) => { const pool = fishPoolFor("river", luck, rod, at), total = pool.reduce((s, e) => s + e.weight, 0);
      return pool.filter((e) => e.fish.rarity !== "common").reduce((s, e) => s + e.weight, 0) / total; };
    expect(rare(0.5 + TOGETHER.luck)).toBeGreaterThan(rare(0.5));
    // The roll uses it: same seed, the together roll matches the luckier pool's.
    const a = fishRoll("river", 0.5, rod, NOON, "clear", seededRandom(3), undefined, undefined, true).fish.key;
    const pool = fishPoolFor("river", 0.5 + TOGETHER.luck, rod, at), r = seededRandom(3)() * pool.reduce((s, e) => s + e.weight, 0);
    let left = r, want = pool[pool.length - 1].fish.key;
    for (const e of pool) { left -= e.weight; if (left <= 0) { want = e.fish.key; break; } }
    expect(a).toBe(want);
  });
});

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
    const WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1, divine: 0.25, contraband: 0 };
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

describe("catch checks judge the new world (the member island's only world)", () => {
  const wharf = (worldDoc.objects as { id: string; x: number; z: number }[]).find(o => o.id === "wharf")!;

  it("casts from the new world's wharf, on the server's cell view", () => {
    expect(village().terrain).toBeUndefined(); // the server's cell view, never the heightfield
    expect(village().map.width).toBe(worldDoc.width);
    expect(castWater("village", [wharf.x, wharf.z])).not.toBeNull();
  });
});

describe("the member island's waters", () => {
  // When a pond is painted into the new world (f-pond), its line here gains "pond".
  it("are what the world has: the new world has no pond yet, the village has all three", () => {
    expect(activeWaters()).toEqual(["sea", "river"]);
  });
});

describe("a meal's buff in the server's roll (f-sushi)", () => {
  it("brings rarer fish with luck and bigger ones with size, within each species' range", () => {
    const run = (buff?: { luck: number; size: number }) => {
      const random = seededRandom(7);
      return Array.from({ length: 4000 }, () => fishRoll("sea", 0, rodByTier(1), NOON, "clear", random, undefined, buff));
    };
    const plain = run(), fed = run({ luck: 0.35, size: 0.6 });
    const rare = (rs: typeof plain) => rs.filter(r => r.fish.rarity !== "common" && r.fish.rarity !== "uncommon").length;
    const ratio = (rs: typeof plain) => rs.reduce((s, { fish, size }) => s + (size - fish.sizeCm[0]) / Math.max(1, fish.sizeCm[1] - fish.sizeCm[0]), 0) / rs.length;
    expect(rare(fed)).toBeGreaterThan(rare(plain) * 1.15);
    expect(ratio(fed)).toBeGreaterThan(ratio(plain) + 0.1);
    expect(fed.every(({ fish, size }) => size >= fish.sizeCm[0] && size <= fish.sizeCm[1])).toBe(true);
  });
});
