import { describe, expect, it } from "vitest";
import { buildVillage, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";
import { WATER_DROP, isGroundAtWorld, shoreSdf } from "./grid";
import { seabedDip } from "./seabed";
import { SEABED_KINDS, seabedProps } from "./seabedProps";

// v1 water item 2: boulders, seagrass and coral-like plants on the seabed in the shallows, instanced. Where they go is
// a property of the map (seeded by place), so every client draws the same seabed.
const { map } = buildVillage(frozen as VillageDoc);
const shore = shoreSdf(map);
const deck = { x0: 7, x1: 9, z0: -23, z1: -17.5 };
const under = (x: number, z: number) => x > deck.x0 && x < deck.x1 && z > deck.z0 && z < deck.z1;

describe("the seabed's props", () => {
  const high = seabedProps(map, shore, { skip: under });
  const lite = seabedProps(map, shore, { skip: under, lite: true });

  it("are the same on every client", () => {
    expect(seabedProps(map, shore, { skip: under })).toEqual(high);
  });
  it("lie in the water on the bed, each kind in its own depth", () => {
    let n = 0;
    for (const kind of SEABED_KINDS) for (const p of high.items[kind.name]) {
      n++;
      expect(isGroundAtWorld(map, p.x, p.z), `${kind.name} at ${p.x},${p.z}`).toBe(false);
      const dip = seabedDip(map, shore, p.x, p.z);
      expect(dip).toBeGreaterThanOrEqual(kind.depth[0] - 1e-6);
      expect(dip).toBeLessThanOrEqual(kind.depth[1] + 1e-6);
      expect(p.y).toBeCloseTo(-WATER_DROP - dip, 6);
    }
    expect(n).toBeGreaterThan(80);
  });
  it("keep out from under the wharf", () => {
    for (const kind of SEABED_KINDS) for (const p of high.items[kind.name]) expect(under(p.x, p.z)).toBe(false);
  });
  it("list the rocks tall enough to break the surface (they get foam rings)", () => {
    expect(high.breaking.length).toBeGreaterThan(0);
    for (const b of high.breaking) expect(b.top).toBeGreaterThan(-WATER_DROP);
  });
  it("are fewer on Lite, and only the cheap kinds", () => {
    const count = (s: typeof high) => Object.values(s.items).reduce((a, l) => a + l.length, 0);
    expect(count(lite)).toBeLessThan(count(high) * 0.6);
    for (const kind of SEABED_KINDS) if (!kind.lite) expect(lite.items[kind.name].length).toBe(0);
  });
});
