import { describe, expect, it } from "vitest";
import { LEVEL_STEP, Surface, WATER_DROP, cellToWorldX, cellToWorldZ, createMap, setCell } from "./grid";
import { rippleDue, waterfallBases } from "./waterRipples";

// v1 water item 3: ripple rings from waterfalls (and steps in the shallows, fish jumps, bobbers). A waterfall is
// derived, never placed (CLAUDE.md rule 4): water beside lower water falls into it, so its rings start at the foot.
describe("waterfall bases", () => {
  const map = createMap(6, 3);
  for (let x = 0; x < 6; x++) for (let z = 0; z < 3; z++) setCell(map, x, z, 0, Surface.Grass);
  // A river at level 2 running into a pool at level 0 between cells 2 and 3, along row 1.
  setCell(map, 1, 1, 2, Surface.River);
  setCell(map, 2, 1, 2, Surface.River);
  setCell(map, 3, 1, 0, Surface.River);
  setCell(map, 4, 1, 0, Surface.River);

  it("puts one at the foot of each drop, on the lower water, against the fall", () => {
    const bases = waterfallBases(map);
    expect(bases).toHaveLength(1);
    const b = bases[0];
    // Half a cell in from the lower cell's centre, toward the upper one.
    expect(b.x).toBeCloseTo((cellToWorldX(map, 2) + cellToWorldX(map, 3)) / 2 + 0.2, 6);
    expect(b.z).toBeCloseTo(cellToWorldZ(map, 1), 6);
    expect(b.y).toBeCloseTo(0 * LEVEL_STEP - WATER_DROP, 6);
    expect(b.drop).toBeCloseTo(2 * LEVEL_STEP, 6);
  });
  it("finds none between water at one level, or water and land", () => {
    const flat = createMap(4, 1);
    for (let x = 0; x < 4; x++) setCell(flat, x, 0, x < 2 ? 0 : 1, x === 1 || x === 2 ? Surface.Grass : Surface.River);
    expect(waterfallBases(flat)).toHaveLength(0);
  });
});

describe("a ripple's schedule", () => {
  it("is due once per period on the world clock, each spot at its own phase", () => {
    let fired = 0;
    for (let t = 1000; t < 1010; t += 0.05) if (rippleDue(t, t + 0.05, 0.5, 3.7)) fired++;
    expect(fired).toBe(20);
    // Two spots never fire in lockstep.
    const at = (phase: number) => { for (let t = 1000; t < 1001; t += 0.01) if (rippleDue(t, t + 0.01, 0.5, phase)) return t; return -1; };
    expect(at(0.3)).not.toBeCloseTo(at(0.7), 2);
  });
});
