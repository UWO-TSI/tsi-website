import { describe, expect, it } from "vitest";
import { terrainV2DraftDoc } from "./terrainV2Draft";
import { buildVillage, parseVillage, villageSpawnPoint } from "../villageMap";
import { MAX_LEVEL, heightAtWorld, isWater, surfaceAt, worldToCellX, worldToCellZ } from "../grid";
import { villageIsland } from "../defaultIsland";
import { ResidentDay, navGrid, newPose, planResidents } from "../residentRoutine";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";

describe("the terrain v2 draft", () => {
  const v = buildVillage(terrainV2DraftDoc());

  // The 384x552 draft makes buildVillage and the residents plan real work: the
  // first test pays the shared setup, so both get room beyond the 5 s default.
  it("parses into a walkable world: spawn on dry land, every level legal", { timeout: 30_000 }, () => {
    const [sx, sz] = villageSpawnPoint(v);
    expect(isWater(surfaceAt(v.map, worldToCellX(v.map, sx), worldToCellZ(v.map, sz)))).toBe(false);
    for (let i = 0; i < v.map.levels.length; i++) {
      expect(v.map.levels[i]).toBeGreaterThanOrEqual(0);
      expect(v.map.levels[i]).toBeLessThanOrEqual(MAX_LEVEL);
    }
    expect(Number.isFinite(heightAtWorld(v.map, sx, sz))).toBe(true);
  });

  it("the north island launches cut off: no bridges, no land path from the village", () => {
    // David 2026-10-10: the launch world is the village; the strait is dug
    // through the drawn neck and the bridges return when the zone opens.
    expect(v.objects.filter(o => o.kind === "bridge").length).toBe(0);
    const { map } = v;
    const [sx, sz] = villageSpawnPoint(v);
    const island = flood(worldToCellX(map, sx), worldToCellZ(map, sz), false);
    const plains = annotations.find(a => a.name.startsWith("Plains"))!;
    for (const [cx, cz] of plains.cells) {
      if (isWater(surfaceAt(map, cx, cz))) continue;
      expect(island.has(cz * map.width + cx), `cell ${cx},${cz}`).toBe(false);
    }
  });

  it("hosts residents without a village: no homes, yet every pose reads all day", { timeout: 30_000 }, () => {
    // The walk bench froze on this map: buildDay assumed plan.home, threw inside
    // useFrame, and the loading screen never lifted. No landmarks may ever crash it.
    const island = villageIsland(v);
    const nav = navGrid(island, v);
    const plans = planResidents(DEFAULT_NPC_PERSONAS.slice(0, 3), v, island);
    const pose = newPose();
    for (const plan of plans) {
      const day = new ResidentDay(plan, nav);
      for (let h = 0; h < 24; h += 3) {
        day.at(Date.parse("2026-10-09T05:00:00Z") / 1000 + h * 3600, null, pose);
        expect(Number.isFinite(pose.x) && Number.isFinite(pose.z), plan.slug).toBe(true);
      }
    }
  });

  // Flood-fill over land cells from (cx, cz). `climb` restricts steps to one level
  // (how far a walker can get without ramps); without it, any land is connected.
  function flood(cx0: number, cz0: number, climb: boolean): Set<number> {
    const { map } = v;
    const land = (cx: number, cz: number) =>
      cx >= 0 && cz >= 0 && cx < map.width && cz < map.depth && !isWater(surfaceAt(map, cx, cz));
    const seen = new Set<number>([cz0 * map.width + cx0]);
    const queue = [[cx0, cz0]];
    while (queue.length) {
      const [cx, cz] = queue.pop()!;
      for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]] as const) {
        const i = nz * map.width + nx;
        if (seen.has(i) || !land(nx, nz)) continue;
        if (climb && Math.abs(map.levels[i] - map.levels[cz * map.width + cx]) > 1) continue;
        seen.add(i);
        queue.push([nx, nz]);
      }
    }
    return seen;
  }

  // buildVillage drops annotations, so the zone notes come from the raw parse.
  const { annotations } = parseVillage(terrainV2DraftDoc());

  it("keeps the plains combat ground open: flat, no cliffs in the zone", () => {
    const { map } = v;
    const plains = annotations.find(a => a.name.startsWith("Plains"))!;
    for (const [cx, cz] of plains.cells) {
      if (isWater(surfaceAt(map, cx, cz))) continue;
      expect(map.levels[cz * map.width + cx], `cell ${cx},${cz}`).toBeLessThanOrEqual(1);
    }
  });

  it("the summit is climbable on foot: village ground to the peak along the trail", () => {
    const { map } = v;
    const village = annotations.find(a => a.name.startsWith("Village"))!;
    const [cx0, cz0] = village.cells.find(([cx, cz]) => !isWater(surfaceAt(map, cx, cz)))!;
    const reach = flood(cx0, cz0, true);
    expect(MAX_LEVEL).toBe(8);
    expect([...reach].some(i => map.levels[i] === MAX_LEVEL)).toBe(true);
  });

  it("the peak waterfall: water high on the mountain, pooling in a pond above the ground", () => {
    const { map } = v;
    let high = 0;
    const pondLevels = new Map<number, number>();
    for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
      if (!isWater(surfaceAt(map, cx, cz))) continue;
      const l = map.levels[cz * map.width + cx];
      high = Math.max(high, l);
      pondLevels.set(l, (pondLevels.get(l) ?? 0) + 1);
    }
    // The run's top rides just below the summit, and the pond pools on the level-2
    // terrace (water sits one below its ground).
    expect(high).toBeGreaterThanOrEqual(MAX_LEVEL - 2);
    expect(pondLevels.get(1) ?? 0).toBeGreaterThanOrEqual(30);
  });

  it("islands are actual islands: every landmass holds playable ground", () => {
    const { map } = v;
    const seen = new Set<number>();
    const sizes: number[] = [];
    for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
      const i = cz * map.width + cx;
      if (seen.has(i) || isWater(surfaceAt(map, cx, cz))) continue;
      const comp = flood(cx, cz, false);
      for (const c of comp) seen.add(c);
      sizes.push(comp.size);
    }
    expect(sizes.length).toBeGreaterThanOrEqual(5);           // plains, main, and the west islets
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(30);
  });
});
