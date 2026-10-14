import { describe, expect, it } from "vitest";
import { buildVillage, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";
import { isGroundAtWorld, shoreSdf } from "./grid";
import { seabedDip } from "./seabed";
import { FISH_DEPTH, fishAt, fishSchools } from "./decorativeFish";

// v1 water item 6: small schools gliding in the shallows. Scenery: they cannot be caught and mark no fishing spot.
// Where a school swims is the map's; where each fish is now is the world clock's (every client sees the same).
const { map } = buildVillage(frozen as VillageDoc);
const shore = shoreSdf(map);
const spot = { x: 2, z: -18.5 };
const nearSpot = (x: number, z: number) => Math.hypot(x - spot.x, z - spot.z) < 3;

describe("decorative fish", () => {
  const schools = fishSchools(map, shore, { avoid: nearSpot });
  const out = { x: 0, y: 0, z: 0, yaw: 0 };

  it("swim in schools on the map, the same on every client", () => {
    expect(schools.length).toBeGreaterThanOrEqual(3);
    expect(fishSchools(map, shore, { avoid: nearSpot })).toEqual(schools);
  });
  it("stay in the shallows all the way round their paths", () => {
    let n = 0;
    for (const s of schools) for (let k = 0; k < s.count; k++) for (let t = 0; t < 120; t += 0.7) {
      fishAt(s, k, 40000 + t, out);
      n++;
      expect(isGroundAtWorld(map, out.x, out.z), `school at ${s.cx},${s.cz}`).toBe(false);
      const dip = seabedDip(map, shore, out.x, out.z);
      expect(dip).toBeGreaterThanOrEqual(FISH_DEPTH[0]);
      expect(dip).toBeLessThanOrEqual(FISH_DEPTH[1]);
      // Under the surface, over the bed.
      expect(out.y).toBeLessThan(-0.078);
      expect(out.y).toBeGreaterThan(-0.078 - dip);
    }
    expect(n).toBeGreaterThan(1000);
  });
  it("keep away from the fishing spots, so they never read as one", () => {
    for (const s of schools) for (let t = 0; t < 60; t += 0.5) {
      fishAt(s, 0, t, out);
      expect(nearSpot(out.x, out.z)).toBe(false);
    }
  });
  it("glide: a fish moves a little each frame, facing the way it goes", () => {
    const s = schools[0], a = { ...out }, b = { ...out };
    fishAt(s, 1, 1000, a);
    fishAt(s, 1, 1000 + 1 / 60, b);
    const step = Math.hypot(b.x - a.x, b.z - a.z);
    expect(step).toBeGreaterThan(0.002);
    expect(step).toBeLessThan(0.05);
    // Its heading (rotation about +y: the model's nose along +z) points along the step.
    expect(Math.sin(a.yaw) * (b.x - a.x) + Math.cos(a.yaw) * (b.z - a.z)).toBeGreaterThan(step * 0.8);
  });
  it("are fewer on Lite", () => {
    const lite = fishSchools(map, shore, { avoid: nearSpot, lite: true });
    const count = (l: typeof schools) => l.reduce((a, s) => a + s.count, 0);
    expect(count(lite)).toBeLessThan(count(schools) * 0.5);
  });
});
