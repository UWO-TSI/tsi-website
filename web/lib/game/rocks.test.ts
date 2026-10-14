import { describe, expect, it } from "vitest";
import { createMap, setCell, Surface, heightField, isGroundAtWorld, cellToWorldX, cellToWorldZ, levelAt, worldToCellX, worldToCellZ, WATER_DROP } from "./grid";
import { ROCK_MODELS, ROCK_SIZE, cliffBoulders, rockProposal } from "./rocks";
import { PROP_FOOTPRINT, PROP_TOP } from "./defaultIsland";
import { village, villageSpawnPoint } from "./villageMap";

/** A 40 × 40 island: grass at level 0, a level-2 plateau (one full cliff) in the middle, sea round the edge. */
function plateau(level = 2, seaSide = false) {
  const m = createMap(40, 40, -20, -20);
  for (let cz = 0; cz < 40; cz++) for (let cx = 0; cx < 40; cx++) {
    const land = cx >= 4 && cx < 36 && cz >= 4 && cz < 36;
    setCell(m, cx, cz, 0, land ? Surface.Grass : Surface.River);
  }
  // The plateau; with `seaSide` it runs out to the sea on its east side, so that wall stands in the water.
  for (let cz = 14; cz < 26; cz++) for (let cx = 14; cx < (seaSide ? 36 : 26); cx++) setCell(m, cx, cz, level, Surface.Grass);
  return m;
}

describe("cliff-foot boulders: a rendering rule derived from the cliff cells (specs/v1-drop.md §8c item 4)", () => {
  it("sits a share of the walls' feet on the low side, never on the plateau", () => {
    const map = plateau();
    const rocks = cliffBoulders(map, heightField(map));
    // 12 cells a side, 4 sides: 48 wall edges.
    expect(rocks.length).toBeGreaterThan(48 * 0.12);
    expect(rocks.length).toBeLessThan(48 * 0.45);
    for (const r of rocks) {
      expect(levelAt(map, worldToCellX(map, r.x), worldToCellZ(map, r.z)), `${r.x},${r.z} on the plateau`).toBe(0);
      // Within a cell of the wall: the plateau spans x, z in [-6.5, 5.5].
      const out = Math.max(-6.5 - r.x, r.x - 5.5, -6.5 - r.z, r.z - 5.5);
      expect(out).toBeGreaterThan(0);
      expect(out).toBeLessThan(0.9);
      expect(ROCK_MODELS).toContain(r.model);
    }
  });
  it("is the same every load", () => {
    const map = plateau();
    expect(cliffBoulders(map, heightField(map))).toEqual(cliffBoulders(map, heightField(map)));
  });
  it("keeps clear of paths and ramps at the foot", () => {
    const map = plateau();
    // A stone path along the whole south foot, and a ramp up the north face.
    for (let cx = 12; cx < 28; cx++) setCell(map, cx, 13, 0, Surface.Stone);
    for (let cx = 14; cx < 26; cx++) setCell(map, cx, 26, 0, Surface.Ramp);
    const rocks = cliffBoulders(map, heightField(map));
    expect(rocks.some(r => r.z < -6.5)).toBe(false);
    expect(rocks.some(r => r.z > 5.5)).toBe(false);
    expect(rocks.length).toBeGreaterThan(0);
  });
  it("never puts two boulders side by side along a straight wall", () => {
    const map = plateau();
    const rocks = cliffBoulders(map, heightField(map));
    for (const a of rocks) for (const b of rocks) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.7);
  });
  it("stands a sea cliff's boulders in the water, sunk below the waterline", () => {
    const map = plateau(2, true);
    const wet = cliffBoulders(map, heightField(map)).filter(r => r.wet);
    expect(wet.length).toBeGreaterThan(0);
    for (const r of wet) {
      expect(isGroundAtWorld(map, r.x, r.z)).toBe(false);
      expect(r.y).toBeLessThan(-WATER_DROP);
    }
  });
  it("gives a tall wall tall rocks, and a one-cliff wall none", () => {
    const low = plateau(2), high = plateau(6);
    const tall = (m: ReturnType<typeof plateau>) => cliffBoulders(m, heightField(m)).filter(r => r.model === "boulder-pillar" || r.model === "boulder-tall");
    expect(tall(low)).toEqual([]);
    expect(tall(high).length).toBeGreaterThan(0);
  });
});

describe("the accent proposal: rock placements for David to review in /lab/map, never written to the map", () => {
  it("proposes rocks on the shipped village that sit on dry land or at the waterline, clear of paths and objects", () => {
    const v = village();
    const proposal = rockProposal(v);
    expect(proposal.length).toBeGreaterThan(4);
    const [sx, sz] = villageSpawnPoint(v);
    const ids = new Set<string>();
    for (const o of proposal) {
      expect(o.kind).toBe("rock");
      expect(ROCK_MODELS).toContain(o.model);
      expect(ids.has(o.id)).toBe(false);
      ids.add(o.id);
      expect(v.objects.some(e => e.kind === "rock" && e.id === o.id)).toBe(false);
      expect(Math.hypot(o.x - sx, o.z - sz)).toBeGreaterThan(3);
      for (const e of v.objects) if (e.kind !== "puddle" && e.kind !== "bug") expect(Math.hypot(o.x - e.x, o.z - e.z), `${o.id} on ${e.kind} ${e.id}`).toBeGreaterThan(1.2);
    }
    for (const a of proposal) for (const b of proposal) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2);
  });
  it("is the same every load", () => {
    expect(rockProposal(village())).toEqual(rockProposal(village()));
  });
});

describe("the rock models", () => {
  it("each has a footprint and a top the walker and the map editor read", () => {
    for (const m of ROCK_MODELS) {
      expect(PROP_FOOTPRINT[m], m).toEqual(ROCK_SIZE[m].half);
      expect(PROP_TOP[m], m).toBe(ROCK_SIZE[m].top);
    }
  });
  it("cell helpers agree with the test island", () => {
    const map = plateau();
    expect(cellToWorldX(map, 14)).toBe(-6);
    expect(cellToWorldZ(map, 25)).toBe(5);
  });
});
