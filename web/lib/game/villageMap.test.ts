import { describe, expect, it } from "vitest";
import doc from "../../data/village-map.json";
import { buildVillage, landBounds, normaliseSea, parseVillage, serialiseVillage, village, villageJson, type VillageDoc } from "./villageMap";
import { villageHealth } from "./mapHealth";
import { villageScale } from "./defaultIsland";
import { createCenteredMap, setCell, Surface } from "./grid";

/**
 * The shipped village map, held to exactly what /lab/map's health panel shows
 * (lib/game/mapHealth.ts). If the panel says healthy, pasting the painter's
 * export over web/data/village-map.json keeps this suite green.
 */
describe("web/data/village-map.json", () => {
  const health = villageHealth(village());
  it("is healthy: terrain, landmarks, anchors, tables, forage and fishing", () => {
    expect(health.problems).toEqual({});
  });
  it("reaches every walkable cell from the spawn", () => {
    expect(health.terrain.stranded).toBe(0);
    expect(health.terrain.reachable).toBeGreaterThan(0);
  });
  it("round-trips through the painter's export unchanged", () => {
    const { map, objects, annotations } = parseVillage(doc as VillageDoc);
    const out = villageJson(serialiseVillage(map, objects, annotations));
    expect(JSON.parse(out)).toEqual(JSON.parse(JSON.stringify(doc)));
  });
});

describe("map document", () => {
  it("paints the sea one way: legacy Void becomes River at level 0", () => {
    const map = createCenteredMap(4, 4);
    map.surfaces.fill(Surface.Void);
    map.levels.fill(3);
    setCell(map, 1, 1, 0, Surface.Grass);
    expect(normaliseSea(map)).toBe(15);
    expect([...map.surfaces].filter(s => s === Surface.River)).toHaveLength(15);
    expect([...map.levels].every(l => l === 0)).toBe(true);
  });
  it("drops objects it does not know and keeps the rest", () => {
    const base = serialiseVillage(createCenteredMap(4, 4), []);
    const { objects } = parseVillage({ ...base, objects: [{ id: "a", kind: "tree", x: 1, z: 2, seed: 3 }, { id: "b", kind: "spaceship", x: 0, z: 0 }, { id: "c", kind: "rock", x: Number.NaN, z: 0 }] });
    expect(objects).toEqual([{ id: "a", kind: "tree", x: 1, z: 2, seed: 3 }]);
  });
});

describe("size-dependent settings follow the map's land", () => {
  const island = (size: number, halfW: number, halfD: number): VillageDoc => {
    const map = createCenteredMap(size, size);
    map.surfaces.fill(Surface.River);
    for (let cz = 0; cz < size; cz++) for (let cx = 0; cx < size; cx++) {
      const x = cx + map.originX, z = cz + map.originZ;
      if (Math.abs(x) <= halfW && Math.abs(z) <= halfD) setCell(map, cx, cz, 0, Surface.Grass);
    }
    return serialiseVillage(map, []);
  };
  it("gives the shipped island's numbers for a 47×39 island on a 64 grid", () => {
    const v = buildVillage(island(64, 23, 19));
    expect(landBounds(v.map)).toMatchObject({ minX: -23.5, maxX: 23.5, minZ: -19.5, maxZ: 19.5 });
    const s = villageScale(v);
    expect(s.shadowExtent).toBe(26);
    expect(s.cloudSize).toEqual([46, 38]);
    expect(s.overview.offset).toEqual([12, 21, -27]);
    expect(s.overview.far).toBe(120);
    expect(s.overviewFog).toBe(0);
    expect(s.glintRadius).toBe(90);
  });
  it("grows with a bigger island", () => {
    const s = villageScale(buildVillage(island(160, 60, 50)));
    expect(s.shadowExtent).toBe(63);
    expect(s.cloudSize).toEqual([120, 100]);
    expect(s.overview.offset[1]).toBeGreaterThan(21 * 2.5);
    expect(s.overview.far).toBeGreaterThan(120);
    expect(s.glintRadius).toBe(138);
  });
});
