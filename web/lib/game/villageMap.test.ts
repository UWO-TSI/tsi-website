import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVillage, landBounds, normaliseSea, parseVillage, serialiseVillage, setVillage, village, type VillageDoc } from "./villageMap";
import { villageScale } from "./defaultIsland";
import { createCenteredMap, setCell, Surface } from "./grid";

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
  it("frames the smooth world's open area on the minimap, not the whole island: its listed landmarks and spawn, plus a margin", async () => {
    const { loadWorldFromDisk } = await import("./world/disk");
    const { villageOfWorld } = await import("./world/village");
    const { landmarks, UNLISTED } = await import("./defaultIsland");
    const v = villageOfWorld(loadWorldFromDisk(join(__dirname, "../../data/world")));
    const m = villageScale(v).minimap, open = landmarks(v).filter(l => !UNLISTED.has(l.id));
    for (const l of open) expect(l.x > m.x0 && l.x < m.x1 && l.z > m.z0 && l.z < m.z1, l.id).toBe(true);
    // The summit temple stays off it until it opens, and the frame is a fraction of the island.
    expect(UNLISTED.has("oracle")).toBe(true);
    const oracle = landmarks(v).find(l => l.id === "oracle")!;
    expect(oracle.z < m.z0 || oracle.z > m.z1).toBe(true);
    expect((m.x1 - m.x0) * (m.z1 - m.z0)).toBeLessThan(0.25 * v.bounds.halfW * v.bounds.halfD * 4);
  });
});

describe("lab fixtures (/lab/island?fixture=terrain)", () => {
  it("swap what every system reads, then back to the member island", async () => {
    const { villageIsland, villageSpawn, landmarks } = await import("./defaultIsland");
    const { setVillageDoc } = await import("./villageMap");
    const shipped = village();
    // A tiny synthetic fixture: a 6×6 grass square in a 16×16 sea, a spawn and one tree.
    const map = createCenteredMap(16, 16);
    map.surfaces.fill(Surface.River);
    for (let z = 5; z < 11; z++) for (let x = 5; x < 11; x++) setCell(map, x, z, 0, Surface.Grass);
    setVillageDoc(serialiseVillage(map, [{ id: "default", kind: "spawn", x: -1, z: 1 }, { id: "tree-0", kind: "tree", x: 1, z: 0, seed: 0 }]));
    try {
      expect(village()).not.toBe(shipped);
      expect(village().map.width).toBe(16);
      expect(villageSpawn()).toEqual([-1, 0, 1]);
      expect(landmarks()).toEqual([]);
      expect(villageIsland().standable(-1, 1)).toBe(true);
      expect(villageIsland().standable(1, 0)).toBe(false);
    } finally {
      setVillage(shipped);
    }
    expect(village().map.width).toBe(shipped.map.width);
  });
});
