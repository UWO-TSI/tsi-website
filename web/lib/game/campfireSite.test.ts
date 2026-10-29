import { describe, expect, it } from "vitest";
import { FIRE } from "./campfire";
import { campfireSite } from "./campfireSite";
import { villageIsland } from "./defaultIsland";
import { join } from "node:path";
import { objectsOf } from "./villageMap";
import { loadWorldFromDisk } from "./world/disk";
import { villageOfWorld } from "./world/village";

const world = loadWorldFromDisk(join(__dirname, "../../data/world"));

describe("where the beach campfire stands (specs/v1-drop.md §3)", () => {
  {
    it("finds open sand by the beach on the member island without its own campfire, both rings dry and clear of furniture and trees", () => {
      const v = villageOfWorld({ ...world, objects: world.objects.filter(o => o.kind !== "campfire") }), site = campfireSite(v)!, island = villageIsland(v);
      expect(site).not.toBeNull();
      const beach = objectsOf("landmark", v).find(o => o.id === "beach")!;
      expect(Math.hypot(site.x - beach.x, site.z - beach.z)).toBeLessThan(14);
      for (const r of [FIRE.sitRadius, FIRE.danceRadius]) for (let a = 0; a < 16; a++) {
        const x = site.x + Math.sin((a / 16) * Math.PI * 2) * r, z = site.z + Math.cos((a / 16) * Math.PI * 2) * r;
        expect(island.standable(x, z), `${r} at ${a}`).toBe(true);
      }
      for (const kind of ["study", "tree", "bench"] as const) for (const o of objectsOf(kind, v)) expect(Math.hypot(o.x - site.x, o.z - site.z), `${kind} ${o.id}`).toBeGreaterThan(FIRE.danceRadius);
    });
  }
  it("takes the map's own campfire when one is placed", () => {
    const own = world.objects.find(o => o.kind === "campfire")!;
    expect(campfireSite(villageOfWorld(world))).toMatchObject({ x: own.x, z: own.z });
  });
});
