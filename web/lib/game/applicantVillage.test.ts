import { describe, it, expect } from "vitest";
import { createApplicantVillage, APPLICANT_SPAWN, ISLAND_PROPS } from "./applicantVillage";
import { createCenteredMap, setCell, Surface, heightField, sampleGroundHeight, sampleHeightField, isGroundAtWorld } from "./grid";

describe("default island movement", () => {
  const island = createApplicantVillage();
  it("starts on dry ground and follows the path to HQ", () => {
    expect(island.standable(APPLICANT_SPAWN[0], APPLICANT_SPAWN[2])).toBe(true);
    const [x, z] = island.move(0, -3, 0, 4);
    expect(x).toBe(0);
    expect(z).toBeCloseTo(4);
  });
  it("can cross the former river on either side of the main path", () => {
    const [x, z] = island.move(6, -3, 6, 5);
    expect(x).toBe(6);
    expect(z).toBeCloseTo(5);
    expect(island.surface(6, -1)).toBe(Surface.Grass);
    expect(island.standable(x, z)).toBe(true);
  });
  it("stops before the building, shore and tree trunks", () => {
    expect(island.move(0, 4, 0, 15)[1]).toBeLessThan(6.7);
    expect(island.move(0, -10, 0, -40)[1]).toBeGreaterThan(-17);
    expect(island.move(-8, -9, -8, -6)[1]).toBeLessThan(-6.6);
  });
  it("keeps solid prop footprints on land and blocks entry from each side", () => {
    for (const prop of ISLAND_PROPS) {
      expect(island.surface(prop.x, prop.z)).not.toBe(Surface.River);
      expect(island.standable(prop.x, prop.z)).toBe(false);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fromX = prop.x + dx * 2, fromZ = prop.z + dz * 2;
        if (!island.standable(fromX, fromZ)) continue;
        const [x, z] = island.move(fromX, fromZ, prop.x, prop.z);
        expect(island.standable(x, z)).toBe(true);
        expect(Math.hypot(x - prop.x, z - prop.z)).toBeGreaterThan(0.35);
      }
    }
  });
  it("keeps the clearing-to-HQ approach clear after furnishing", () => {
    expect(island.move(0, -10, 0, 6)).toEqual([0, expect.closeTo(6, 5)]);
    expect(island.standable(5.6, 4.5)).toBe(true);
    expect(island.standable(5, 5.3)).toBe(false);
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


it("blocks the water exposed by rounded land corners while keeping straight crossings open", () => {
  const map = createCenteredMap(7, 7);
  for (let z = 0; z < 7; z++) for (let x = 0; x < 7; x++) setCell(map, x, z, 0, Surface.River);
  // A broad square of land has one rounded outer corner at (0.5, 0.5).
  for (let z = 1; z <= 3; z++) for (let x = 1; x <= 3; x++) setCell(map, x, z, 0, Surface.Grass);
  expect(isGroundAtWorld(map, 0, 0)).toBe(true);
  expect(isGroundAtWorld(map, 0.45, 0.45)).toBe(false);
  expect(isGroundAtWorld(map, 0.4, -0.4)).toBe(true);
  expect(isGroundAtWorld(map, 1, 1)).toBe(false);
  expect(isGroundAtWorld(map, 20, 20)).toBe(false);
  for (let z = 0; z < 7; z++) setCell(map, 5, z, 0, Surface.Wood);
  expect(isGroundAtWorld(map, 2, 0)).toBe(true);
  expect(isGroundAtWorld(map, 2.4, 0.4)).toBe(true);
});


it("offers fishing around the whole shoreline and keeps casts in water", () => {
  const island = createApplicantVillage();
  const quadrants = new Set<string>();
  let shorelineSamples = 0;
  for (let x = -17; x <= 17; x += 0.5) for (let z = -16; z <= 16; z += 0.5) {
    if (!island.standable(x, z)) continue;
    const nearWater = [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => !isGroundAtWorld(island.map, x + dx, z + dz));
    if (!nearWater) continue;
    const target = island.fishingTarget(x, z);
    expect(target, `shore at ${x}, ${z}`).not.toBeNull();
    if (!target) continue;
    shorelineSamples++;
    quadrants.add(`${Math.sign(x)},${Math.sign(z)}`);
    expect(isGroundAtWorld(island.map, ...target)).toBe(false);
    const length = Math.hypot(target[0] - x, target[1] - z);
    for (const extension of [0.6, 2.6]) {
      expect(isGroundAtWorld(island.map, target[0] + (target[0] - x) / length * extension, target[1] + (target[1] - z) / length * extension)).toBe(false);
    }
  }
  expect(shorelineSamples).toBeGreaterThan(300);
  expect(quadrants.size).toBeGreaterThanOrEqual(4);
  expect(island.fishingTarget(0, 0)).toBeNull();
  expect(island.fishingTarget(20, 20)).toBeNull();
});
