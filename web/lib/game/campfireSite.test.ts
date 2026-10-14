import { describe, expect, it } from "vitest";
import { FIRE } from "./campfire";
import { campfireSite } from "./campfireSite";
import { villageIsland } from "./defaultIsland";
import { buildVillage, objectsOf, village, type VillageDoc } from "./villageMap";
import worldDoc from "@/data/world-map.json";

describe("where the beach campfire stands (specs/v1-drop.md §3)", () => {
  for (const [name, v] of [["the shipped village", village()], ["the v2 world", buildVillage(worldDoc as VillageDoc)]] as const) {
    it(`finds open sand by the beach on ${name}, with both rings dry and clear of furniture and trees`, () => {
      const site = campfireSite(v)!, island = villageIsland(v);
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
  it("takes the map's own campfire when the painter has placed one", () => {
    const doc = structuredClone(worldDoc) as VillageDoc;
    doc.objects = [...(doc.objects ?? []), { id: "campfire", kind: "campfire", x: -12, z: 108 }];
    expect(campfireSite(buildVillage(doc))).toEqual({ x: -12, z: 108 });
  });
});
