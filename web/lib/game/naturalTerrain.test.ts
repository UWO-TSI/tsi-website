import { afterEach, describe, expect, it } from "vitest";
import {
  CLIFF_LEVELS, COAST, LATTICE, LEVEL_STEP, Surface, WATER_DROP, cellToWorldX, cellToWorldZ, createCenteredMap, forgetTerrain, heightField,
  isGroundAtWorld, isLandCell, latticeAt, overlayAt, refreshTerrain, sampleGroundHeight, setCell, terrainOf, type IslandMap,
} from "./grid";
import { terrainFixtureMap } from "./fixtures/terrainFixture";
import { villageOf } from "./villageMap";
import { islandOf } from "./defaultIsland";
import { walkTo } from "./movement/sim";
import { fishingSpot, waterClassifier } from "./fishingSpots";
import { terrainHealth, terrainProblems } from "./mapHealth";
import { terrainChunks } from "@/components/game/grid/GridTerrain";

/** An oval island of grass in the sea. */
function island(w = 40, d = 40, rx = 14, rz = 11): IslandMap {
  const map = createCenteredMap(w, d);
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const land = ((x - w / 2) / rx) ** 2 + ((z - d / 2) / rz) ** 2 < 1;
    setCell(map, x, z, 0, land ? Surface.Grass : Surface.River);
  }
  return map;
}

/** The point along a ray where the coast crosses 0 (bisection), as the distance from its start. */
function crossing(map: IslandMap, x: number, z: number, dx: number, dz: number, far = 4): number {
  const { coast } = terrainOf(map);
  let a = 0, b = far;
  const land = (t: number) => latticeAt(map, coast, x + dx * t, z + dz * t) > 0;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (land(m) === land(0)) a = m; else b = m; }
  return (a + b) / 2;
}

const saved = { ...COAST };
/** Run with the coast noise off, to measure the blur's shape alone. */
function calm() { Object.assign(COAST, { sea: 0, river: 0 }); }
afterEach(() => Object.assign(COAST, saved));

describe("the organic coast", () => {
  it("is the same for the same map, and a one-cell edit changes it only nearby", () => {
    const a = island(), b = island();
    expect(terrainOf(a).coast).toEqual(terrainOf(b).coast);
    const before = terrainOf(a).coast.slice();
    setCell(a, 33, 20, 0, Surface.River); // nibble the east coast
    const after = terrainOf(a).coast, LW = a.width * LATTICE + 1;
    let far = 0;
    for (let p = 0; p < after.length; p++) {
      if (Math.abs(after[p] - before[p]) < 1e-6) continue;
      const i = p % LW, k = Math.floor(p / LW);
      far = Math.max(far, Math.abs(i / LATTICE - 33.5), Math.abs(k / LATTICE - 20.5));
    }
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThanOrEqual(8);
  });

  it("keeps every painted cell centre on its own side, thin channels and spits included", () => {
    const map = island(48, 48, 18, 16);
    // A one-cell river across the island and a one-cell spit out to sea.
    for (let x = 6; x < 42; x++) setCell(map, x, 24, 0, Surface.River);
    for (let z = 4; z < 10; z++) setCell(map, 24, z, 0, Surface.Grass);
    for (let z = 0; z < map.depth; z++) for (let x = 0; x < map.width; x++) {
      expect(isGroundAtWorld(map, cellToWorldX(map, x), cellToWorldZ(map, z)), `${x},${z}`).toBe(isLandCell(map, x, z));
    }
    // The river stays open along its whole length, the spit joined along its whole length.
    for (let x = 8; x < 40; x += 0.25) expect(isGroundAtWorld(map, map.originX + x, map.originZ + 24)).toBe(false);
    for (let z = 4; z < 9; z += 0.25) expect(isGroundAtWorld(map, map.originX + 24, map.originZ + z)).toBe(true);
  });

  it("turns a 45-degree staircase into a straight shore", () => {
    calm();
    const map = createCenteredMap(40, 40);
    for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) setCell(map, x, z, 0, x + z < 40 ? Surface.Grass : Surface.River);
    // Rays along the diagonal's normal, a quarter cell apart: a staircase would zigzag ±0.35 cells.
    const n = Math.SQRT1_2, offsets: number[] = [];
    for (let t = -6; t <= 6; t += 0.25) {
      const x0 = map.originX + 19.5 - 2 * n + t * n, z0 = map.originZ + 19.5 - 2 * n - t * n;
      offsets.push(crossing(map, x0, z0, n, n));
    }
    const mean = offsets.reduce((s, v) => s + v, 0) / offsets.length;
    expect(Math.max(...offsets.map((v) => Math.abs(v - mean)))).toBeLessThan(0.05);
  });

  it("rounds a point and fills the back of a bay", () => {
    calm();
    const map = createCenteredMap(30, 30);
    for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) {
      const land = (z < 15 && !(x >= 13 && x <= 16 && z >= 10)) || (x >= 6 && x <= 8 && z >= 15 && z <= 20);
      setCell(map, x, z, 0, land ? Surface.Grass : Surface.River);
    }
    // The point's painted corner (cell 8,20's outer corner) is sea now; its middle is still land.
    expect(isGroundAtWorld(map, cellToWorldX(map, 8) + 0.5, cellToWorldZ(map, 20) + 0.5)).toBe(false);
    expect(isGroundAtWorld(map, cellToWorldX(map, 7), cellToWorldZ(map, 20))).toBe(true);
    // The bay's back corners fill in: just inside the painted water corner is land.
    expect(isGroundAtWorld(map, cellToWorldX(map, 13) - 0.4, cellToWorldZ(map, 10) - 0.4)).toBe(true);
    expect(isGroundAtWorld(map, cellToWorldX(map, 13) - 0.3, cellToWorldZ(map, 10) - 0.3 + 0.05)).toBe(true);
  });

  it("refreshes a brushed region to exactly what a full rebuild gives", () => {
    const map = island(64, 64, 22, 20);
    terrainOf(map);
    // Edit in place the way the painter's brush does, then re-derive just that region.
    for (let z = 10; z < 15; z++) for (let x = 40; x < 47; x++) map.surfaces[z * map.width + x] = Surface.Sand;
    for (let z = 30; z < 33; z++) for (let x = 2; x < 9; x++) map.surfaces[z * map.width + x] = Surface.Grass;
    refreshTerrain(map, 2, 10, 46, 32);
    const patched = terrainOf(map);
    const fresh = { ...map, levels: map.levels.slice(), surfaces: map.surfaces.slice() };
    for (const key of ["coast", "beach"] as const) {
      const want = terrainOf(fresh)[key];
      let worst = 0;
      for (let p = 0; p < want.length; p++) worst = Math.max(worst, Math.abs(want[p] - patched[key][p]));
      expect(worst, key).toBeLessThan(1e-5);
    }
    forgetTerrain(map);
  });
});

describe("overlay blends", () => {
  it("wears a soil path into the grass, and runs it solid up to water and to built ground", () => {
    const map = createCenteredMap(20, 20);
    for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) setCell(map, x, z, 0, x >= 17 ? Surface.River : x >= 14 ? Surface.Stone : Surface.Grass);
    for (let z = 2; z < 18; z++) for (let x = 8; x < 11; x++) setCell(map, x, z, 0, Surface.Soil);
    for (let x = 11; x < 17; x++) setCell(map, x, 10, 0, Surface.Soil); // a spur out to the plaza and the water
    for (let z = 3; z < 17; z++) {
      expect(overlayAt(map, Surface.Soil, cellToWorldX(map, 9), cellToWorldZ(map, z))).toBe(1);
      // A cell and a half out into the grass it is gone.
      expect(overlayAt(map, Surface.Soil, cellToWorldX(map, 9) - 2.5, cellToWorldZ(map, z))).toBe(0);
    }
    // Its edge is worn: somewhere along it the fade sits outside the painted line, somewhere inside.
    const edge = Array.from({ length: 60 }, (_, i) => overlayAt(map, Surface.Soil, cellToWorldX(map, 8) - 0.5, cellToWorldZ(map, 3) + i * 0.2));
    expect(Math.max(...edge) - Math.min(...edge)).toBeGreaterThan(0.3);
    // No green rim where the spur meets the plaza.
    expect(overlayAt(map, Surface.Soil, cellToWorldX(map, 13) + 0.45, cellToWorldZ(map, 10))).toBeGreaterThan(0.95);
  });

  it("keeps built ground crisp with rounded corners", () => {
    const map = createCenteredMap(20, 20);
    for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) setCell(map, x, z, 0, x >= 7 && x <= 12 && z >= 7 && z <= 12 ? Surface.Stone : Surface.Grass);
    const x0 = cellToWorldX(map, 7) - 0.5, mid = cellToWorldZ(map, 10);
    expect(overlayAt(map, Surface.Stone, x0 + 0.08, mid)).toBe(1);
    expect(overlayAt(map, Surface.Stone, x0 - 0.08, mid)).toBe(0);
    // The painted corner is cut round.
    expect(overlayAt(map, Surface.Stone, x0 + 0.1, cellToWorldZ(map, 7) - 0.4)).toBe(0);
  });
});

describe("the sloping beach", () => {
  it("runs sand down to the waterline and leaves a grass bank standing", () => {
    calm();
    const map = createCenteredMap(30, 30);
    for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) setCell(map, x, z, 0, z >= 20 ? Surface.River : z >= 16 && x < 15 ? Surface.Sand : Surface.Grass);
    const field = heightField(map);
    for (const [x, sand] of [[cellToWorldX(map, 6), true], [cellToWorldX(map, 24), false]] as const) {
      const z = map.originZ + 19.5 + crossing(map, x, map.originZ + 19, 0, 1) - 0.5;
      expect(sampleGroundHeight(map, field, x, z - 0.01)).toBeCloseTo(sand ? -WATER_DROP : 0, 2);
      expect(sampleGroundHeight(map, field, x, z - 2.5)).toBeCloseTo(0, 3);
    }
  });
});

describe("walking, fishing and the drawn ground agree (the synthetic island)", () => {
  const map = terrainFixtureMap(), v = villageOf(map, [{ id: "default", kind: "spawn", x: 0, z: -2 }]), island = islandOf(v);

  it("is wet exactly where the coast is water, and stands on exactly the ground the mesh draws, at its height", () => {
    for (let z = -22; z <= 22; z += 0.37) for (let x = -31; x <= 31; x += 0.37) expect(island.wet(x, z), `${x},${z}`).toBe(!isGroundAtWorld(map, x, z));
    // Every grass vertex the mesh draws inside a cell (not on a shared edge) sits on the walking height, on land.
    let checked = 0;
    for (const { surface, geometry } of terrainChunks(map, v.field)) {
      if (surface !== Surface.Grass) continue;
      const p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i += 3) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), fx = x - map.originX + 0.5, fz = z - map.originZ + 0.5;
        if (Math.abs(fx - Math.round(fx)) < 0.01 || Math.abs(fz - Math.round(fz)) < 0.01) continue;
        expect(y, `${x},${z}`).toBeCloseTo(sampleGroundHeight(map, v.field, x, z), 4);
        expect(latticeAt(map, terrainOf(map).coast, x, z), `${x},${z}`).toBeGreaterThan(-1e-4);
        checked++;
      }
      geometry.dispose();
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("walks up the hill and the mountain, stops at the cliff face, climbs the ramp, and never walks into the sea", () => {
    // The steep mountain (a level per 1.5 cells) from its foot to its top.
    const top = walkTo(island, -12, -14, -12, -6);
    expect(Math.hypot(top.x + 12, top.z + 6)).toBeLessThan(0.5);
    expect(top.y).toBeGreaterThan(3);
    // Straight at the plateau's face: stopped below it. Up the ramp: on top.
    const face = walkTo(island, 4, -8, 12, -8);
    expect(face.y).toBeLessThan(0.1);
    expect(face.x).toBeLessThan(7.6);
    const ramp = walkTo(island, 12, -16.5, 12, -11);
    expect(ramp.y).toBeCloseTo(CLIFF_LEVELS * LEVEL_STEP, 1);
    // Out to sea from the beach: the walker stops on the sand at the waterline.
    const shore = walkTo(island, 0, 12, 0, 30);
    expect(isGroundAtWorld(map, shore.x, shore.z)).toBe(true);
    expect(shore.z).toBeGreaterThan(17);
    expect(shore.y).toBeLessThan(-WATER_DROP / 2);
  });

  it("casts from the beach into water", () => {
    const spot = fishingSpot(map, waterClassifier(map), 0, 18);
    expect(spot).not.toBeNull();
    expect(isGroundAtWorld(map, ...spot!.target)).toBe(false);
    expect(spot!.water).toBe("sea");
  });

  it("is healthy terrain: everything reachable by slopes and the ramp, cliffs drawable, mostly flat", () => {
    const t = terrainHealth(map, [32, 30]);
    expect(terrainProblems(t)).toEqual({});
    expect(t.slopeCells).toBeGreaterThan(50);
    expect(t.cliffCells).toBeGreaterThan(10);
  });
});
