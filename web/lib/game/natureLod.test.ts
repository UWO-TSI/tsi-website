import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOD1_DISTANCE, LOD_BAND, lodOf, updateNear } from "./natureLod";
import { SEASON_BUSHES } from "./seasonalLook";
import { SEASONS } from "./season";
import { glbStats } from "./perf/glbStats";

const pub = join(__dirname, "../../public");
const at = (...xyz: number[]) => new Float32Array(xyz);

describe("distance LOD for instanced nature (the bushes' near and far models)", () => {
  it("draws a placement near inside LOD1_DISTANCE of the camera and far outside it", () => {
    const near = new Uint8Array(3);
    expect(updateNear(near, at(0, 0, 5, 0, 0, LOD1_DISTANCE + 5, 0, 0, -3), 0, 0, 0)).toBe(true);
    expect([...near]).toEqual([1, 0, 1]);
    // Nothing moved: nothing changes.
    expect(updateNear(near, at(0, 0, 5, 0, 0, LOD1_DISTANCE + 5, 0, 0, -3), 0, 0, 0)).toBe(false);
  });
  it("holds its level inside the band either side of the line, so one standing on it doesn't flicker", () => {
    const near = new Uint8Array(1);
    const on = (d: number) => { updateNear(near, at(0, 0, d), 0, 0, 0); return near[0]; };
    expect(on(LOD1_DISTANCE - LOD_BAND - 0.1)).toBe(1);
    expect(on(LOD1_DISTANCE + LOD_BAND * 0.5)).toBe(1);
    expect(on(LOD1_DISTANCE + LOD_BAND + 0.1)).toBe(0);
    expect(on(LOD1_DISTANCE - LOD_BAND * 0.5)).toBe(0);
    expect(on(LOD1_DISTANCE - LOD_BAND - 0.1)).toBe(1);
  });
  it("gives every season's bush a far model that ships and is lighter than the near one", () => {
    for (const season of SEASONS) for (const url of SEASON_BUSHES[season]) {
      const far = lodOf(url);
      expect(far, url).toBeTruthy();
      expect(existsSync(join(pub, url)), url).toBe(true);
      expect(existsSync(join(pub, far!)), far!).toBe(true);
      const a = glbStats(readFileSync(join(pub, url))), b = glbStats(readFileSync(join(pub, far!)));
      expect(b.triangles, far!).toBeLessThan(a.triangles * 0.5);
      expect([a.primitives, b.primitives, a.materials, b.materials]).toEqual([1, 1, 1, 1]);
    }
    expect(lodOf("/assets/acnh/plants/tree-cedar.glb")).toBeNull();
  });
});
