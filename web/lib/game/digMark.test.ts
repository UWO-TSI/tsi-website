import { describe, expect, it } from "vitest";
import { TWITCH_S, digScuff, digTwitch } from "./digMark";

const radius = (g: ReturnType<typeof digScuff>) => { g.computeBoundingSphere(); return g.boundingSphere!.radius; };
const flatFinite = (g: ReturnType<typeof digScuff>) => {
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) { expect(Number.isFinite(p.getX(i)) && Number.isFinite(p.getZ(i))).toBe(true); expect(p.getY(i)).toBe(0); }
  return p.count;
};

// David 2026-10-28: "way more subtle and small", "hard to find usually"; the sand's "similar to the dirt".
describe("a dig spot's mark", () => {
  it("is a small flat scuff with two crumbs, its own per seed", () => {
    for (const seed of [3, 10, 17]) {
      const g = digScuff(seed);
      expect(flatFinite(g)).toBe((9 + 5 + 5) * 3);
      expect(radius(g)).toBeLessThan(0.35);
    }
    expect(digScuff(3).getAttribute("position").array).not.toEqual(digScuff(10).getAttribute("position").array);
  });
});

// r3, the sand's mark: "make it move or twitch a lil bit".
describe("a dig spot's twitch", () => {
  const sample = (seed: number) => Array.from({ length: 1200 }, (_, i) => digTwitch(i / 60, seed));
  it("rests most of the time and twitches a little every few seconds, its own rhythm per spot", () => {
    for (const seed of [3, 10.5, 77]) {
      const s = sample(seed), moving = s.filter(x => x.scale !== 1 || x.turn !== 0).length / s.length;
      expect(moving).toBeGreaterThan(0.03);
      expect(moving).toBeLessThan(0.2);
      for (const x of s) { expect(Math.abs(x.scale - 1)).toBeLessThan(0.25); expect(Math.abs(x.turn)).toBeLessThan(0.23); }
    }
    expect(sample(3)).not.toEqual(sample(77));
  });
  it("settles back to rest as each twitch ends", () => {
    const at = sample(3).findIndex(x => x.scale !== 1);
    const end = digTwitch(at / 60 + TWITCH_S - 0.01, 3);
    expect(Math.abs(end.scale - 1)).toBeLessThan(0.01);
    expect(Math.abs(end.turn)).toBeLessThan(0.01);
  });
});
