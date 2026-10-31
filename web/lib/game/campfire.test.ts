import { describe, expect, it } from "vitest";
import { SOFT_BEAT } from "./danceSync";
import { DRUM_LAYERS, FIRE, drumGains, drumLayers, fireLit, fireScale, freeSlot, isCampfireHour, ringPoint, sitPoint } from "./campfire";

describe("the campfire's drum song (specs/v1-drop.md §3)", () => {
  it("adds one unique layer per dancer, six at most, and six dancers play the full song", () => {
    expect(DRUM_LAYERS).toHaveLength(6);
    expect(new Set(DRUM_LAYERS.map(l => l.src)).size).toBe(6);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => drumLayers(n))).toEqual([0, 1, 2, 3, 4, 5, 6, 6, 6]);
    expect(drumLayers(-1)).toBe(0);
    expect(drumLayers(FIRE.maxDancers)).toBe(DRUM_LAYERS.length);
  });
  it("fades a layer in for each dancer, in order, and none for nobody", () => {
    expect(drumGains(0).every(g => g === 0)).toBe(true);
    const three = drumGains(3);
    expect(three.slice(0, 3).every(g => g > 0)).toBe(true);
    expect(three.slice(3).every(g => g === 0)).toBe(true);
    expect(drumGains(6).every(g => g > 0)).toBe(true);
    expect(drumGains(8)).toEqual(drumGains(6));
  });
});

describe("the fire grows with every dancer", () => {
  it("is bigger and brighter with each dancer up to eight, then holds", () => {
    let prev = fireScale(0);
    expect(prev.size).toBe(1);
    expect(prev.light).toBe(1);
    for (let n = 1; n <= FIRE.maxDancers; n++) {
      const s = fireScale(n);
      expect(s.size, `${n} dancers`).toBeGreaterThan(prev.size);
      expect(s.light, `${n} dancers`).toBeGreaterThan(prev.light);
      prev = s;
    }
    expect(fireScale(12)).toEqual(fireScale(FIRE.maxDancers));
    expect(fireScale(FIRE.maxDancers).size).toBeLessThanOrEqual(2);
  });
  it("is lit every real night", () => {
    expect(fireLit("night")).toBe(true);
    expect(fireLit("day")).toBe(false);
    expect(fireLit("dawn")).toBe(false);
    expect(fireLit("evening")).toBe(false);
  });
});

describe("the rings round the fire", () => {
  const fire = { x: 10, z: -4 };
  it("seats sitters evenly round the fire, facing it", () => {
    for (let k = 0; k < FIRE.sitSlots; k++) {
      const p = sitPoint(fire, k);
      expect(Math.hypot(p.x - fire.x, p.z - fire.z)).toBeCloseTo(FIRE.sitRadius);
      // Facing the fire: the yaw points from the seat to its centre.
      expect(Math.sin(p.yaw)).toBeCloseTo((fire.x - p.x) / FIRE.sitRadius);
      expect(Math.cos(p.yaw)).toBeCloseTo((fire.z - p.z) / FIRE.sitRadius);
    }
  });
  it("turns the dance ring on the world clock, so every client puts a slot in the same place", () => {
    const a = ringPoint(fire, 2, 100), b = ringPoint(fire, 2, 100);
    expect(a).toEqual(b);
    const later = ringPoint(fire, 2, 100 + FIRE.ringPeriodS / 4);
    const ang = (p: { x: number; z: number }) => Math.atan2(p.x - fire.x, p.z - fire.z);
    expect(Math.abs(Math.atan2(Math.sin(ang(later) - ang(a)), Math.cos(ang(later) - ang(a))))).toBeCloseTo(Math.PI / 2);
    expect(Math.hypot(a.x - fire.x, a.z - fire.z)).toBeCloseTo(FIRE.danceRadius);
    // Walking the ring: facing along it, not at the fire.
    const ahead = ringPoint(fire, 2, 100.01);
    expect(Math.sin(a.yaw) * (ahead.x - a.x) + Math.cos(a.yaw) * (ahead.z - a.z)).toBeGreaterThan(0);
  });
  it("picks the free slot nearest you, and none when the ring is full", () => {
    const taken = [sitPoint(fire, 0)];
    const me = sitPoint(fire, 0);
    // Standing where slot 0 is, with someone in it: one of its two neighbours.
    expect([1, FIRE.sitSlots - 1]).toContain(freeSlot(FIRE.sitSlots, k => sitPoint(fire, k), me.x, me.z, taken));
    expect(freeSlot(FIRE.sitSlots, k => sitPoint(fire, k), me.x, me.z, [])).toBe(0);
    const all = Array.from({ length: FIRE.sitSlots }, (_, i) => sitPoint(fire, i));
    expect(freeSlot(FIRE.sitSlots, k => sitPoint(fire, k), me.x, me.z, all)).toBe(-1);
  });
});

describe("the drum loops on disk (public/audio/CREDITS.md)", () => {
  it("ships every layer and the soft beat, each with its CC0 source recorded", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pub = join(__dirname, "../../public");
    const credits = readFileSync(join(pub, "audio/CREDITS.md"), "utf8");
    for (const { src } of [...DRUM_LAYERS, SOFT_BEAT]) {
      expect(existsSync(join(pub, src)), src).toBe(true);
      const row = credits.split("\n").find(l => l.includes(`\`${src.replace("/audio/", "")}\``));
      expect(row, `${src} has no row in CREDITS.md`).toBeDefined();
      expect(row).toMatch(/freesound\.org\/people\/[^/]+\/sounds\/\d+\/.*\| CC0 \|/);
    }
  });
});

describe("campfire hour (s-campfire)", () => {
  it("runs from 8 to 9 pm Toronto time", () => {
    expect([19.99, 20, 20.5, 20.99, 21].map(isCampfireHour)).toEqual([false, true, true, true, false]);
  });
  it("lights the fire whatever the phase and plays the full drum circle", () => {
    expect(fireLit("evening", true)).toBe(true);
    expect(drumLayers(0, true)).toBe(DRUM_LAYERS.length);
    expect(drumLayers(2)).toBe(2);
  });
});
