import { describe, expect, it } from "vitest";
import { Color } from "three";
import { DEPTH_RAMP, WATER_DEPTH_RAMP, bedDepth, waterRampAt } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";
import { ISLAND_LIGHTING } from "./islandLighting";

// v1 water pass item 1 (specs/v1-drop.md §8c.1): the water's colour comes from how deep it is over the known seabed,
// sand-tinted teal over the shallows grading to deep navy (references/look/2026-10-13/water-foam-shallows-ref.png).

const DAY = ISLAND_LIGHTING.day.water;
const lin = (hex: number) => new Color(hex).toArray() as [number, number, number];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe("the seabed's depth profile", () => {
  const p = TUNING_DEFAULTS.water;
  it("starts at the waterline and only ever gets deeper", () => {
    expect(bedDepth(0, p)).toBe(0);
    let last = 0;
    for (let d = 0.05; d < 40; d += 0.05) {
      const now = bedDepth(d, p);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });
  it("keeps the shallows shallow and drops off to the open sea's depth past the shelf", () => {
    expect(bedDepth(0.5, p)).toBeLessThan(0.5);
    // A river (at most a few cells from a bank) never reaches the drop-off.
    expect(bedDepth(p.shelfFrom, p)).toBeLessThanOrEqual(p.bedDepth + 1e-9);
    expect(bedDepth(p.shelfTo + 4, p)).toBeGreaterThan(p.bedDepth + p.shelfDepth * 0.95);
  });
});

describe("the water's colour by depth", () => {
  it("is the seabed's own sand at the waterline", () => {
    expect(dist(waterRampAt(0, DAY), lin(DAY.bedColor))).toBeLessThan(1e-6);
  });
  it("darkens all the way down", () => {
    let last = luma(waterRampAt(0, DAY));
    for (let depth = 0.1; depth < 8; depth += 0.1) {
      const now = luma(waterRampAt(depth, DAY));
      expect(now).toBeLessThanOrEqual(last + 1e-9);
      last = now;
    }
  });
  it("is a sand-tinted teal over the shallows", () => {
    const shallow = waterRampAt(0.3, DAY);
    // Nearer the sand-teal stop than the navy, green leading (teal), with warmth left from the sand under it.
    expect(dist(shallow, lin(DAY.shallowColor))).toBeLessThan(dist(shallow, lin(DAY.navyColor)));
    expect(shallow[1]).toBeGreaterThan(shallow[2] * 0.9);
    expect(shallow[0]).toBeGreaterThan(waterRampAt(1.5, DAY)[0]);
  });
  it("is deep navy over the open sea", () => {
    const sea = waterRampAt(bedDepth(30, DAY), DAY);
    expect(dist(sea, lin(DAY.navyColor))).toBeLessThan(0.03);
    expect(sea[2]).toBeGreaterThan(sea[1]);
    expect(sea[1]).toBeGreaterThan(sea[0]);
  });
  it("prints the same ramp into the shader it computes", () => {
    for (const [a, b] of DEPTH_RAMP) expect(WATER_DEPTH_RAMP).toContain(`smoothstep(${a.toFixed(2)}, ${b.toFixed(2)}, t)`);
    for (const stop of ["uBedColor", "uShallowColor", "uMidColor", "uDeepColor", "uNavyColor"]) expect(WATER_DEPTH_RAMP).toContain(stop);
  });
  it("has a navy for every phase, darker than the deep teal above it", () => {
    for (const phase of ["dawn", "day", "evening", "night"] as const) {
      const w = ISLAND_LIGHTING[phase].water;
      expect(luma(lin(w.navyColor))).toBeLessThan(luma(lin(w.deepColor)));
    }
  });
});
