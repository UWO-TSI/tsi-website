import { describe, it, expect } from "vitest";
import { benchSeat, islandOf, landmark, landmarkPoint, landmarks, LANDMARK_IDS, propFootprint, villageIsland, villageSpawn, wharfDeck } from "./defaultIsland";
import { clearSpot, walkTo } from "./movement/sim";
import { createCenteredMap, setCell, Surface, heightField, sampleGroundHeight, sampleHeightField, isGroundAtWorld, surfaceAt } from "./grid";
import { buildVillage, objectsOf, village, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";

/**
 * Walking mechanics on a frozen copy of the 2026-09-28 village (the island as
 * code built it, exported to the map file): these need one known geometry, a
 * bridge here, a river there. What the LIVE map must satisfy is in
 * villageMap.test.ts (the painter's health panel) and the generic block below.
 */
const v0 = buildVillage(frozen as VillageDoc);
const DEFAULT_SPAWN = villageSpawn(v0);
const ISLAND_TREES = objectsOf("tree", v0).map(t => [t.x, t.z] as const);
const ISLAND_PROPS = [...objectsOf("bench", v0), ...objectsOf("rock", v0)].map(p => ({ x: p.x, z: p.z }));
const LANDMARKS = landmarks(v0);
const WHARF_DECK = wharfDeck(v0)!;

describe("default island movement (frozen 2026-09-28 village)", () => {
  const island = islandOf(v0);
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
    expect(benchSeat(4, 4.5, 1.3, v0)).toMatchObject({ x: 5, z: 4.5 });
    expect(benchSeat(4, 4.5, 1.3, v0)?.yaw).toBeCloseTo(Math.PI * 1.5);
    expect(benchSeat(6, 4.5, 1.3, v0)?.yaw).toBeCloseTo(Math.PI / 2);
    expect(benchSeat(-6, -9, 1.3, v0)).toEqual({ x: -6, z: -8, yaw: Math.PI });
    expect(benchSeat(0, 0, 1.3, v0)).toBeNull();
    const [x, z] = island.move(5, 4.5, 3.8, 4.5);
    expect(x).toBeCloseTo(3.8);
    expect(z).toBeCloseTo(4.5);
  });
  it("lets the walker reach the shop, café door and plaza boards from spawn", () => {
    let [x, z] = island.move(0, -10, 0, -9.5);
    [x, z] = island.move(x, z, 10, -9.5);
    expect(Math.hypot(x - 10, z + 9.5)).toBeLessThan(0.1);
    [x, z] = island.move(0, -9.5, -10, -9.5);
    expect(Math.hypot(x + 10, z + 9.5)).toBeLessThan(0.1);
    [x, z] = island.move(0, -10, 0, 4.5);
    expect(landmarks(v0).some(l => (l.id === "notice" || l.id === "catch") && Math.hypot(l.x - x, l.z - z) < 3.2)).toBe(true);
  });
  it("has water in the pond and a walkable wharf stub over the sea", () => {
    expect(island.surface(landmark("pond", v0)!.x, landmark("pond", v0)!.z)).toBe(Surface.River);
    expect(island.standable((WHARF_DECK.x0 + WHARF_DECK.x1) / 2, WHARF_DECK.z0 + 0.5)).toBe(true);
    expect(isGroundAtWorld(island.map, 8, -22.5)).toBe(false);
  });
  it("raises the Oracle temple on a half-step rise that stays walkable", () => {
    const oracle = landmark("oracle", v0)!;
    expect(island.ground(oracle.x, oracle.z - 3)).toBeGreaterThan(0.3);
    const [, z] = island.move(oracle.x - 2.5, 2.5, oracle.x - 2.5, oracle.z - oracle.half![1] - 0.5);
    expect(z).toBeGreaterThan(6.2);
  });
  it("keeps buildings solid, on dry land, with a standable approach in front", () => {
    for (const l of LANDMARKS.filter(l => l.half)) {
      expect(island.standable(l.x, l.z), l.id).toBe(false);
      expect(island.surface(l.x, l.z), l.id).not.toBe(Surface.River);
      const frontZ = l.z - l.half![1] - 0.6;
      expect(island.standable(l.x, frontZ) || island.standable(l.x + 0.8, frontZ), `${l.id} approach`).toBe(true);
    }
    expect(ISLAND_PROPS.length).toBeGreaterThan(0);
  });
});

describe("a ramp climbs a full cliff", () => {
  // Level 0 ground, a 2-level plateau from z >= 2, a two-cell ramp run at x = 0 (cells z 0, 1).
  const map = createCenteredMap(9, 9);
  for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) setCell(map, x, z, z >= 6 ? 2 : 0, Surface.Grass);
  setCell(map, 4, 4, 0, Surface.Ramp); setCell(map, 4, 5, 0, Surface.Ramp);
  const island = islandOf({ map, field: heightField(map), objects: [], bounds: { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5, cx: 0, cz: 0, halfW: 4.5, halfD: 4.5 } });
  it("walks up the ramp but not up the cliff beside it", () => {
    expect(island.move(0, -2, 0, 3)[1]).toBeCloseTo(3);
    expect(island.ground(0, 3)).toBeCloseTo(1.5);
    expect(island.move(2, -2, 2, 3)[1]).toBeLessThan(1.6);
  });
});

describe("the live village map (web/data/village-map.json)", () => {
  const island = villageIsland();
  it("places every landmark from ledger row 155, with the closed ones closed", () => {
    expect(landmarks().map(l => l.id).sort()).toEqual([...LANDMARK_IDS].sort());
    expect(landmarks().filter(l => !l.open).map(l => l.id).sort()).toEqual(["cafe", "museum", "ruins"]);
    // A completed club goal opens its building (cafe-polish §3).
    expect(landmarks(undefined, ["cafe"]).filter(l => !l.open).map(l => l.id).sort()).toEqual(["museum", "ruins"]);
  });
  it("keeps solid prop footprints on land and blocks entry from each side", () => {
    for (const prop of [...objectsOf("bench"), ...objectsOf("rock")]) {
      expect(propFootprint(prop), prop.id).not.toBeNull();
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
  it("stops the walker before every tree trunk", () => {
    for (const { x: tx, z: tz } of objectsOf("tree")) {
      const from = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].map(([dx, dz]) => [tx + dx, tz + dz]).find(([x, z]) => island.standable(x, z));
      if (!from) continue;
      const [x, z] = island.move(from[0], from[1], tx, tz);
      expect(Math.hypot(x - tx, z - tz)).toBeGreaterThan(0.6);
    }
  });
  it("sits you on each bench facing the side you came from", () => {
    for (const b of objectsOf("bench")) {
      const yaw = b.yaw ?? 0, nx = Math.sin(yaw), nz = Math.cos(yaw);
      expect(benchSeat(b.x + nx * 0.8, b.z + nz * 0.8)?.yaw, b.id).toBeCloseTo(yaw);
      expect(benchSeat(b.x - nx * 0.8, b.z - nz * 0.8)?.yaw, b.id).toBeCloseTo(yaw + Math.PI);
    }
  });
  it("on the movement kit: every door is reached from its exit spot, the spawn and exits stand in the open", () => {
    for (const id of ["hq", "oracle", "wharf", "cafe"] as const) {
      const door = landmarkPoint(id, "door"), exit = landmarkPoint(id, "exit");
      if (!door || !exit) continue;
      const s = walkTo(island, exit[0], exit[1], door[0], door[1]);
      // The scene's prompt ranges: the clubhouse door 2, the temple and the boat 1.6, the café 1.4.
      expect(Math.hypot(s.x - door[0], s.z - door[1]), id).toBeLessThan(id === "cafe" ? 1.4 : 1.6);
    }
    // Coming back out of the café you stand clear of its door prompt (cafe-polish §2).
    const [cd, ce] = [landmarkPoint("cafe", "door")!, landmarkPoint("cafe", "exit")!];
    expect(Math.hypot(cd[0] - ce[0], cd[1] - ce[1])).toBeGreaterThan(1.4);
    const [sx, , sz] = villageSpawn();
    const exits = (["hq", "oracle", "museum", "cafe", "ruins", "wharf"] as const).map(id => landmarkPoint(id, "exit")).filter(p => p !== null);
    for (const [x, z] of [[sx, sz], ...exits]) expect(clearSpot(island, x, z, island.ground(x, z), 0), `${x}, ${z}`).toEqual([x, z]);
  });
  it("gets up from every bench into the open, still in reach of it, and walks away", () => {
    for (const b of objectsOf("bench")) {
      const yaw = b.yaw ?? 0, seat = benchSeat(b.x + Math.sin(yaw) * 0.8, b.z + Math.cos(yaw) * 0.8)!;
      const [x, z] = clearSpot(island, seat.x, seat.z, island.ground(seat.x, seat.z), seat.yaw);
      expect(island.standable(x, z), b.id).toBe(true);
      expect(Math.hypot(x - b.x, z - b.z), b.id).toBeGreaterThan(0.35);
      expect(benchSeat(x, z), b.id).not.toBeNull(); // E sits you back down from where you got up
      const away = walkTo(island, x, z, x + Math.sin(seat.yaw) * 2, z + Math.cos(seat.yaw) * 2);
      expect(Math.hypot(away.x - x, away.z - z), b.id).toBeGreaterThan(0.5);
    }
  });
  it("never ends a move off open ground", () => {
    const { bounds: b } = village();
    for (let i = 0; i < 300; i++) {
      const a = [b.cx + Math.sin(i * 1.7) * b.halfW, b.cz + Math.cos(i * 2.3) * b.halfD], t = [b.cx + Math.sin(i * 0.9) * b.halfW, b.cz + Math.cos(i * 1.1) * b.halfD];
      if (!island.standable(a[0], a[1])) continue;
      const [x, z] = island.move(a[0], a[1], t[0], t[1]);
      expect(island.standable(x, z), `${a} → ${t}`).toBe(true);
    }
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


it("holds every painted cell centre on its side of the organic coast, rounds corners, keeps a one-cell crossing open", () => {
  const map = createCenteredMap(7, 7);
  for (let z = 0; z < 7; z++) for (let x = 0; x < 7; x++) setCell(map, x, z, 0, Surface.River);
  // A small square of land: the coast rounds its corners off.
  for (let z = 1; z <= 3; z++) for (let x = 1; x <= 3; x++) setCell(map, x, z, 0, Surface.Grass);
  // A one-cell wooden crossing over the water: built land keeps a crisp edge.
  for (let z = 0; z < 7; z++) setCell(map, 5, z, 0, Surface.Wood);
  for (let z = 0; z < 7; z++) for (let x = 0; x < 7; x++) {
    expect(isGroundAtWorld(map, map.originX + x, map.originZ + z), `${x},${z}`).toBe(surfaceAt(map, x, z) !== Surface.River);
  }
  expect(isGroundAtWorld(map, 0.45, 0.45)).toBe(false);
  expect(isGroundAtWorld(map, 20, 20)).toBe(false);
  for (let z = -2; z <= 2; z += 0.25) for (const dx of [-0.3, 0, 0.3]) expect(isGroundAtWorld(map, 2 + dx, z), `${2 + dx},${z}`).toBe(true);
});
