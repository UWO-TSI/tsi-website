import { describe, expect, it } from "vitest";
import { FISH, type FishDef } from "./fishing";
import { BOSS, advanceFishingReel, bossPhase, createFishingReel, type FishingReel } from "./fishingReel";

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
/** A big slow fish to stand in for any boss: the boss rules come from the reel, not the species. */
const boss: FishDef = { ...FISH[0], key: "test_boss", rarity: "legendary", move: { speed: 0.4, accel: 2, jitter: 0.008, dartChance: 0.3, dartMul: 2.2, retargetMs: 1000 } };

/**
 * Steers the bar onto the fish; `heeds` also reads the warnings (eases off through a jump, reels through slack). Like a
 * person it decides every fifth of a second, not every frame.
 */
function player(heeds: boolean) {
  return (s: FishingReel) => {
    const live = s.boss?.stage === "live" ? s.boss.move : null;
    if (heeds && live === "jump") return false;
    if (heeds && live === "slack") return true;
    return s.fishPosition - s.barWidth / 2 - s.position - s.velocity * 0.2 > 0;
  };
}
function fight(seed: number, policy: (s: FishingReel) => boolean, fish = boss) {
  const s = createFishingReel(fish), random = seeded(seed);
  let hold = false;
  for (let i = 0; i < 60 * 180 && s.result === null; i++) {
    if (i % 12 === 0) hold = policy(s);
    advanceFishingReel(s, 1 / 60, hold, 1, random);
  }
  return s;
}

describe("the boss reel", () => {
  it("is only for legendary and divine fish, and a divine fish's stamina is the room's", () => {
    expect(createFishingReel({ ...boss, rarity: "epic" }).boss).toBeNull();
    expect(createFishingReel(boss).boss?.shared).toBe(false);
    expect(createFishingReel({ ...boss, rarity: "seaking" }).boss?.shared).toBe(true);
  });

  it("goes through its phases as stamina falls", () => {
    expect([bossPhase(1), bossPhase(0.5), bossPhase(0.1)]).toEqual([1, 2, 3]);
    const s = fight(7, player(true));
    expect(s.result).not.toBeNull();
  });

  it("warns of every move before it makes it, and makes all four", () => {
    const seen = new Set<string>();
    for (let seed = 3; seed < 8; seed++) {
      const s = createFishingReel(boss), random = seeded(seed);
      let warned: string | null = null;
      for (let i = 0; i < 60 * 180 && s.result === null; i++) {
        const e = advanceFishingReel(s, 1 / 60, player(true)(s), 1, random);
        if (e.warned) warned = e.warned;
        if (e.moved) { expect(e.moved).toBe(warned); seen.add(e.moved); }
      }
    }
    expect(seen.size).toBe(4);
  });

  it("a player who heeds the warnings usually lands it; one who ignores them usually loses it", () => {
    const runs = 40;
    let heed = 0, ignore = 0;
    for (let i = 0; i < runs; i++) {
      if (fight(1000 + i, player(true)).result) heed++;
      if (fight(1000 + i, player(false)).result) ignore++;
    }
    expect(heed / runs).toBeGreaterThan(0.35);
    expect(heed / runs).toBeLessThan(0.9); // a real chance to lose it
    expect(ignore / runs).toBeLessThan(0.3);
  });

  it("takes a fight, not a moment, to land, and an ordinary epic stays the easy reel", () => {
    const wins = Array.from({ length: 10 }, (_, i) => fight(200 + i, player(true))).filter((s) => s.result);
    expect(wins.length).toBeGreaterThan(0);
    for (const s of wins) expect(s.elapsed).toBeGreaterThan(1 / BOSS.wear);
    const epic = Array.from({ length: 10 }, (_, i) => fight(200 + i, player(false), { ...boss, rarity: "epic" }));
    expect(epic.filter((s) => s.result).length).toBeGreaterThanOrEqual(9);
  });

  it("leaves a shared (divine) fish's stamina to the room and reports the damage dealt", () => {
    const s = createFishingReel({ ...boss, rarity: "seaking" }), random = seeded(5);
    for (let i = 0; i < 600; i++) advanceFishingReel(s, 1 / 60, player(true)(s), 1, random);
    expect(s.boss!.stamina).toBe(1);
    expect(s.boss!.dealt).toBeGreaterThan(0);
  });
});
