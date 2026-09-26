import { describe, it, expect } from "vitest";
import { benchSeat, createDefaultIsland, DEFAULT_SPAWN, ISLAND_PROPS, ISLAND_TREES, LANDMARKS, WHARF_DECK, landmark, nearestLandmark } from "./defaultIsland";
import { createCenteredMap, setCell, Surface, heightField, sampleGroundHeight, sampleHeightField, isGroundAtWorld } from "./grid";

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
    const shore = island.move(3, -10, 3, -40)[1];
    expect(shore).toBeGreaterThan(-20.5);
    expect(shore).toBeLessThan(-17);
    for (const [tx, tz] of ISLAND_TREES) {
      const from = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].map(([dx, dz]) => [tx + dx, tz + dz]).find(([x, z]) => island.standable(x, z));
      if (!from) continue;
      const [x, z] = island.move(from[0], from[1], tx, tz);
      expect(Math.hypot(x - tx, z - tz)).toBeGreaterThan(0.6);
    }
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
  it("sits you mid-bench facing the side you came from, and lets you step off", () => {
    // Plaza bench (5, 4.5) runs north-south: from the plaza side you face west, from the east you face east.
    expect(benchSeat(4, 4.5)).toMatchObject({ x: 5, z: 4.5 });
    expect(benchSeat(4, 4.5)?.yaw).toBeCloseTo(Math.PI * 1.5);
    expect(benchSeat(6, 4.5)?.yaw).toBeCloseTo(Math.PI / 2);
    expect(benchSeat(-6, -9)).toEqual({ x: -6, z: -8, yaw: Math.PI });
    expect(benchSeat(0, 0)).toBeNull();
    const [x, z] = island.move(5, 4.5, 3.8, 4.5);
    expect(x).toBeCloseTo(3.8);
    expect(z).toBeCloseTo(4.5);
  });
});

describe("village core layout", () => {
  const island = createDefaultIsland();
  it("places every landmark from ledger row 155", () => {
    expect(LANDMARKS.map(l => l.id).sort()).toEqual(["beach", "cafe", "catch", "hq", "mailbox", "monument", "museum", "notice", "oracle", "plaza", "pond", "ruins", "shop", "wharf"]);
    expect(LANDMARKS.filter(l => !l.open).map(l => l.id).sort()).toEqual(["cafe", "museum", "ruins"]);
  });
  it("keeps buildings solid, on dry land, with a standable approach in front", () => {
    for (const l of LANDMARKS.filter(l => l.half)) {
      expect(island.standable(l.x, l.z), l.id).toBe(false);
      expect(island.surface(l.x, l.z), l.id).not.toBe(Surface.River);
      const frontZ = l.z - l.half![1] - 0.6;
      expect(island.standable(l.x, frontZ) || island.standable(l.x + 0.8, frontZ), `${l.id} approach`).toBe(true);
    }
  });
  it("lets the walker reach the shop, café door and plaza boards from spawn", () => {
    let [x, z] = island.move(0, -10, 0, -9.5);
    [x, z] = island.move(x, z, 10, -9.5);
    expect(Math.hypot(x - 10, z + 9.5)).toBeLessThan(0.1);
    [x, z] = island.move(0, -9.5, -10, -9.5);
    expect(Math.hypot(x + 10, z + 9.5)).toBeLessThan(0.1);
    [x, z] = island.move(0, -10, 0, 4.5);
    expect(nearestLandmark(x, z, 3.2, ["notice", "catch"])).not.toBeNull();
  });
  it("has water in the pond and a walkable wharf stub over the sea", () => {
    expect(island.surface(landmark("pond").x, landmark("pond").z)).toBe(Surface.River);
    expect(island.standable((WHARF_DECK.x0 + WHARF_DECK.x1) / 2, WHARF_DECK.z0 + 0.5)).toBe(true);
    expect(isGroundAtWorld(island.map, 8, -22.5)).toBe(false);
  });
  it("raises the Oracle temple on a half-step rise that stays walkable", () => {
    const oracle = landmark("oracle");
    expect(island.ground(oracle.x, oracle.z - 3)).toBeGreaterThan(0.3);
    const [, z] = island.move(oracle.x - 2.5, 2.5, oracle.x - 2.5, oracle.z - oracle.half![1] - 0.5);
    expect(z).toBeGreaterThan(6.2);
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
