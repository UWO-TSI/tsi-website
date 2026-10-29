import { describe, expect, it } from "vitest";
import { buildVillage, parseVillage, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";
import { coastDistance, isGroundAtWorld, sampleShore, shoreSdf } from "./grid";
import { BERTH_EDGE, bakeWaterDepth, seabedDip } from "./seabed";
import { SHOAL, bedDepth } from "./waterShader";
import { MOORED, berthWeight } from "./wharf";
import { TUNING_DEFAULTS } from "./tuning";

// The water's colour reads the seabed's depth from a bake (v1 water item 1: "from the known seabed height, with no
// extra render pass"). The bake and the bed mesh must be one seabed, or the shallows are the wrong colour for how deep
// they visibly are.
const { map } = buildVillage(frozen as VillageDoc);
const shore = shoreSdf(map);
const depth = bakeWaterDepth(map, shore);
/** The bake as the GPU reads it: bilinear between sample centres, clamped at the edges (the shore field's own lookup). */
const sampleDepth = (x: number, z: number) => sampleShore({ ...shore, data: depth }, x, z);

describe("the seabed bake", () => {
  it("is one value per shore field sample", () => {
    expect(depth.length).toBe(shore.data.length);
  });
  it("is zero on land and the bed's depth over water", () => {
    let land = 0, water = 0;
    for (let i = 0; i < depth.length; i++) {
      if (shore.data[i] <= 0) { expect(depth[i]).toBe(0); land++; }
      else { expect(depth[i]).toBeGreaterThan(0); water++; }
    }
    expect(land).toBeGreaterThan(1000);
    expect(water).toBeGreaterThan(1000);
  });
  it("agrees with the bed the mesh draws, wherever there is water", () => {
    let worst = 0, n = 0;
    for (let z = map.originZ; z < map.originZ + map.depth - 1; z += 0.37) for (let x = map.originX; x < map.originX + map.width - 1; x += 0.41) {
      if (coastDistance(map, x, z) > -0.3) continue; // the waterline itself moves with the lap
      n++;
      worst = Math.max(worst, Math.abs(sampleDepth(x, z) - seabedDip(map, shore, x, z)));
    }
    expect(n).toBeGreaterThan(5000);
    // Within 8 cm: the bake's four samples a cell against the function itself (the mesh is coarser still: a vertex a
    // cell, or four where the coast crosses it).
    expect(worst).toBeLessThan(0.08);
  });
  it("drops off to the open sea's depth far from the coast", () => {
    const far = Math.max(...depth);
    const p = TUNING_DEFAULTS.water;
    expect(far).toBeGreaterThan(p.bedDepth + p.shelfDepth * 0.9);
    expect(far).toBeLessThanOrEqual(bedDepth(1e3, p) + 1e-3);
  });
});

// Playtest round 1 (David, 2026-10-14): "make the shallow water bigger area around main island". The village's sea
// shelves out as sand you can see before the drop-off; the river through the island keeps its banks; the wharf's berth
// stays deep for the boats moored there.
describe("the main island's wide shallows", () => {
  const village = buildVillage(frozen as VillageDoc);
  const vmap = village.map, vshore = shoreSdf(vmap);
  const dip = (x: number, z: number) => seabedDip(vmap, vshore, x, z);
  const wharf = village.objects.find(o => o.kind === "landmark" && o.id === "wharf")!;
  const dock = { x: wharf.x, z: wharf.z, yaw: wharf.yaw ?? 0 };
  /** A point in the dock's frame (lib/game/wharf.ts), in the world. */
  const inDock = (lx: number, lz: number) => { const c = Math.cos(dock.yaw), s = Math.sin(dock.yaw); return [dock.x + lx * c + lz * s, dock.z - lx * s + lz * c] as const; };

  it("shelves out as sand under the water all the way round the island before it drops off", () => {
    let coasts = 0;
    for (let a = 0; a < 32; a++) {
      const dx = Math.cos((a / 32) * Math.PI * 2), dz = Math.sin((a / 32) * Math.PI * 2);
      // In from the map's edge to the first land: the beach's waterline (the river through the middle never reached).
      let r = 31;
      while (r > 0 && !isGroundAtWorld(vmap, dx * r, dz * r)) r -= 0.05;
      if (r < 15) continue; // in along the river's mouth
      const out = (k: number) => [dx * (r + k), dz * (r + k)] as const;
      if (berthWeight(dock, ...out(2), BERTH_EDGE) > 0 || berthWeight(dock, ...out(4), BERTH_EDGE) > 0) continue; // the wharf's berth
      coasts++;
      // Three cells out the sand still shows (the ramp short of its teal); the old bed was 1.4 deep there.
      expect(dip(...out(3)), `3 out at ${a}`).toBeLessThan(SHOAL.depth + 0.02);
      expect(dip(...out(1)), `1 out at ${a}`).toBeLessThan(0.25);
      // Past the shallows the drop-off to the teal and the navy.
      expect(dip(...out(7)), `7 out at ${a}`).toBeGreaterThan(1.4);
    }
    expect(coasts).toBeGreaterThan(26);
  });
  it("keeps the river's banks: its water through the island is as deep as it was", () => {
    // The same map without the village's shallows (parseVillage alone registers none): the seabed as it was.
    const plain = parseVillage(frozen as VillageDoc).map, plainShore = shoreSdf(plain);
    let n = 0;
    for (let z = vmap.originZ; z < vmap.originZ + vmap.depth; z += 0.25) for (let x = -12; x <= 12; x += 0.25) {
      if (sampleShore(vshore, x, z) < 0.3 || isGroundAtWorld(vmap, x, z) || Math.hypot(x, z) > 18) continue;
      n++;
      expect(dip(x, z), `river at ${x},${z}`).toBeCloseTo(seabedDip(plain, plainShore, x, z), 6);
    }
    expect(n).toBeGreaterThan(50);
    // And deep enough to read as water, not as ice (the river's own tuning, lib/game/tuning.ts bedSlope).
    expect(dip(5, 0.5)).toBeGreaterThan(0.6);
  });
  it("keeps the wharf's berth deep: the tip, the moored boat and the rowboats float over deep water", () => {
    for (const [lx, lz] of [[0, -3.5], [MOORED.x, MOORED.z]]) {
      expect(dip(...inDock(lx, lz)), `berth at ${lx},${lz}`).toBeGreaterThan(1.2);
    }
  });
  it("bakes the same seabed the mesh draws, the shallows and the berth included", () => {
    const bake = bakeWaterDepth(vmap, vshore), at = (x: number, z: number) => sampleShore({ ...vshore, data: bake }, x, z);
    let worst = 0;
    for (let z = vmap.originZ; z < vmap.originZ + vmap.depth - 1; z += 0.37) for (let x = vmap.originX; x < vmap.originX + vmap.width - 1; x += 0.41) {
      if (coastDistance(vmap, x, z) > -0.3) continue;
      worst = Math.max(worst, Math.abs(at(x, z) - dip(x, z)));
    }
    expect(worst).toBeLessThan(0.08);
  });
});
