import { describe, expect, it } from "vitest";
import { createCenteredMap, setCell, Surface, cellToWorldX, cellToWorldZ, worldToCellX, type IslandMap } from "./grid";
import { glideSpot, guideStep, newGuide } from "./glideGuide";

/** A 24 x 24 meadow at level 0 with a plateau at level 2 (a cliff) in its west half, and a river strip at the east edge. */
function island(): IslandMap {
  const map = createCenteredMap(24, 24);
  for (let cz = 0; cz < 24; cz++) for (let cx = 0; cx < 24; cx++) setCell(map, cx, cz, cx < 10 ? 2 : 0, cx >= 21 ? Surface.River : Surface.Grass);
  return map;
}

describe("the guided first glide's spot", () => {
  it("finds the nearest cliff top facing lower land, with a landing ring out on that land", () => {
    const map = island(), x = cellToWorldX(map, 6), z = cellToWorldZ(map, 12);
    const s = glideSpot(map, x, z)!;
    expect(s).not.toBeNull();
    expect(s.drop).toBeGreaterThanOrEqual(2);
    // The edge is the plateau's east rim, facing +x.
    expect(s.dir).toEqual([1, 0]);
    expect(s.edge[0]).toBeCloseTo(cellToWorldX(map, 9) + 0.5, 6);
    // The ring: on the meadow, a glide's reach out from the edge, never in the river.
    const out = s.land[0] - s.edge[0];
    expect(out).toBeGreaterThanOrEqual(3.5);
    expect(out).toBeLessThanOrEqual(7.5);
    expect(s.land[0]).toBeLessThan(cellToWorldX(map, 21) - 0.5);
  });

  it("takes a bank when there's no cliff, and never a ramp's slope", () => {
    const map = createCenteredMap(20, 20);
    for (let cz = 0; cz < 20; cz++) for (let cx = 0; cx < 20; cx++) setCell(map, cx, cz, cz < 8 ? 1 : 0, cz === 8 && cx < 4 ? Surface.Ramp : Surface.Grass);
    const s = glideSpot(map, cellToWorldX(map, 2), cellToWorldZ(map, 4))!;
    expect(s.drop).toBe(1);
    expect(s.dir).toEqual([0, 1]);
    // The ramp (columns 0-3 of the bank's foot) is a slope you walk down, not an edge: the spot is past it.
    expect(worldToCellX(map, s.edge[0])).toBeGreaterThanOrEqual(4);
  });

  it("has nothing to offer on flat ground or when every drop runs straight into water or a wall", () => {
    const flat = createCenteredMap(16, 16);
    for (let cz = 0; cz < 16; cz++) for (let cx = 0; cx < 16; cx++) setCell(flat, cx, cz, 1, Surface.Grass);
    expect(glideSpot(flat, 0, 0)).toBeNull();
    const wet = createCenteredMap(16, 16);
    for (let cz = 0; cz < 16; cz++) for (let cx = 0; cx < 16; cx++) setCell(wet, cx, cz, cx < 6 ? 2 : 0, cx < 6 ? Surface.Grass : Surface.River);
    expect(glideSpot(wet, cellToWorldX(wet, 2), 0)).toBeNull();
  });
});

describe("the guided first glide", () => {
  const spot = { edge: [0, 0] as [number, number], dir: [1, 0] as [number, number], land: [5, 0] as [number, number], drop: 2, top: 1.5, below: 0 };
  it("waits for a real glide (in the air a while), then says how it went where it came down", () => {
    let g = newGuide(spot);
    g = guideStep(g, { x: 0, z: 0, aloft: false }, 0);
    expect(g.phase).toBe("hint");
    g = guideStep(g, { x: 0.5, z: 0, aloft: true }, 1000);
    g = guideStep(g, { x: 1.5, z: 0, aloft: true }, 1300);
    expect(g.phase).toBe("hint"); // a hop is not a glide
    g = guideStep(g, { x: 3, z: 0, aloft: true }, 1800);
    expect(g.phase).toBe("gliding");
    const landed = guideStep(g, { x: 5.4, z: 0.6, aloft: false }, 2600);
    expect(landed.phase).toBe("done");
  });

  it("calls a landing outside the ring a near miss and lets you go again", () => {
    let g = newGuide(spot);
    g = guideStep(g, { x: 1, z: 0, aloft: true }, 0);
    g = guideStep(g, { x: 2, z: 0, aloft: true }, 900);
    g = guideStep(g, { x: 9.5, z: 2, aloft: false }, 1500);
    expect(g.phase).toBe("missed");
    g = guideStep(g, { x: 9.5, z: 2, aloft: false }, 1500 + 2600);
    expect(g.phase).toBe("hint");
  });
});
