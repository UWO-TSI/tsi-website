import { describe, it, expect } from "vitest";
import { createDefaultIsland, DEFAULT_SPAWN } from "./defaultIsland";
import { createCenteredMap, setCell, Surface, heightField, sampleGroundHeight, sampleHeightField } from "./grid";

describe("default island movement", () => {
  const island = createDefaultIsland();
  it("starts on dry ground and crosses the wooden passage", () => {
    expect(island.standable(DEFAULT_SPAWN[0], DEFAULT_SPAWN[2])).toBe(true);
    const [x, z] = island.move(0, -3, 0, 4);
    expect(x).toBe(0);
    expect(z).toBeCloseTo(4);
  });
  it("cannot tunnel across water even in a large move", () => {
    const [x, z] = island.move(6, -3, 6, 5);
    expect(x).toBe(6);
    expect(z).toBeLessThan(-0.5);
    expect(island.standable(x, z)).toBe(true);
  });
  it("stops before the building, shore and tree trunks", () => {
    expect(island.move(0, 4, 0, 15)[1]).toBeLessThan(6.7);
    expect(island.move(0, -10, 0, -40)[1]).toBeGreaterThan(-17);
    expect(island.move(-8, -9, -8, -6)[1]).toBeLessThan(-6.6);
  });
  it("allows a diagonal to slide along the building", () => {
    const [x, z] = island.move(0, 6, 5, 9);
    expect(x).toBeCloseTo(5);
    expect(island.standable(x, z)).toBe(true);
  });
});

it("keeps the walker on the low side of cliff-pinned height corners", () => {
  const map = createCenteredMap(9, 9);
  for (let z = 1; z < 8; z++) for (let x = 5; x < 8; x++) setCell(map, x, z, 2, Surface.Grass);
  const field = heightField(map);
  expect(sampleHeightField(map, field, 0, 0)).toBeGreaterThan(0.5);
  expect(sampleGroundHeight(map, field, 0, 0)).toBe(0);
  expect(sampleGroundHeight(map, field, 2, 0)).toBeCloseTo(1.5);
});
