import { describe, expect, it } from "vitest";
import { buildVillage, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";
import { coastDistance, sampleShore, shoreSdf } from "./grid";
import { bakeWaterDepth, seabedDip } from "./seabed";
import { bedDepth } from "./waterShader";
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
