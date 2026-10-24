import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BARRIERS, BARRIER_MODELS, barrierBoxes, barrierFootprint, barrierPlacements, inBarrier } from "./barriers";
import { DROPS, dropFlags } from "./drops";
import { createCenteredMap, levelAt, setCell, Surface, worldToCellX, worldToCellZ } from "./grid";
import { readGlb } from "./perf/glbStats";
import { islandOf, objectFootprint } from "./defaultIsland";
import { buildVillage, parseVillage, serialiseVillage, village, villageOf, type MapObject, type VillageDoc } from "./villageMap";
import proposal from "@/data/proposals/v1-barriers.json";

/** A flat grass island, 40 × 40, with these objects. */
function flatIsland(objects: MapObject[]) {
  const map = createCenteredMap(40, 40);
  for (let cz = 0; cz < 40; cz++) for (let cx = 0; cx < 40; cx++) setCell(map, cx, cz, Surface.Grass, 0);
  return villageOf(map, objects);
}
/** The GLB's footprint where a body bumps it (vertices under 1.2 up; boughs overhead don't count), in the model's frame. */
function glbBounds(model: string) {
  const { json, bin } = readGlb(readFileSync(join(__dirname, "../../public", BARRIERS[model as keyof typeof BARRIERS].url!)));
  const j = json as unknown as { meshes: { primitives: { attributes: { POSITION: number } }[] }[]; accessors: { bufferView: number; byteOffset?: number; count: number }[]; bufferViews: { byteOffset?: number; byteStride?: number }[] };
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const m of j.meshes) for (const p of m.primitives) {
    const a = j.accessors[p.attributes.POSITION], view = j.bufferViews[a.bufferView];
    const data = new DataView(bin!.buffer, bin!.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)), stride = view.byteStride ?? 12;
    for (let i = 0; i < a.count; i++) {
      const x = data.getFloat32(i * stride, true), y = data.getFloat32(i * stride + 4, true), z = data.getFloat32(i * stride + 8, true);
      if (y > 1.2) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  return { x0, x1, z0, z1 };
}

describe("natural barriers (specs/v1-drop.md §2, lib/game/barriers.ts)", () => {
  it("each is cleared by its own drop: the rockslide with the mountain, the forest and rubble with the ruins, the bridge not yet", () => {
    expect(BARRIERS.rockslide.feature).toBe("mountain");
    expect(BARRIERS["forest-edge"].feature).toBe("forest");
    expect(BARRIERS["ruins-rubble"].feature).toBe("ruins");
    expect(BARRIERS["unbuilt-bridge"].feature).toBe("northIsland");
  });

  it("blocks walking through it, from every side, and can't be jumped (its top is a wall's)", () => {
    const v = flatIsland([{ id: "default", kind: "spawn", x: 0, z: -12 }, { id: "slide", kind: "barrier", model: "rockslide", x: 0, z: 0, yaw: 0.4 }]);
    const island = islandOf(v);
    expect(island.top(0, 0)).toBe(Infinity);
    for (const [fx, fz] of [[0, -8], [0, 8], [-8, 0], [8, 0]]) {
      const [x, z] = island.move(fx, fz, -fx, -fz);
      // Stopped on the near side, never through (a straight line through the middle).
      expect(Math.sign(x || fx) === Math.sign(fx) || Math.sign(z || fz) === Math.sign(fz)).toBe(true);
      expect(Math.hypot(x, z)).toBeGreaterThan(1.4);
    }
    // Open ground either side still walks.
    expect(island.standable(0, -6)).toBe(true);
    expect(island.standable(0, 6)).toBe(true);
    // The blade grass's `clear` list (GridWorld, DefaultIslandWorld grassClear: nothing taller than the ground stands
    // there) keeps grass out of a barrier, the same rule as every other solid.
    const grassClear = (x: number, z: number) => island.top(x, z) <= island.ground(x, z) + 0.01;
    expect(grassClear(0, 0)).toBe(false);
    expect(grassClear(1.5, 0.5)).toBe(false);
    expect(grassClear(0, -6)).toBe(true);
  });

  it("is gone, prop and solid, once its drop is out", () => {
    const v = flatIsland([{ id: "slide", kind: "barrier", model: "rockslide", x: 0, z: 0 }, { id: "edge", kind: "barrier", model: "forest-edge", x: 10, z: 0 }]);
    expect(barrierPlacements(v, dropFlags(1)).map(b => b.id)).toEqual(["slide", "edge"]);
    expect(barrierPlacements(v, dropFlags(2)).map(b => b.id)).toEqual(["edge"]);
    expect(barrierPlacements(v, dropFlags(3))).toEqual([]);
    expect(inBarrier(barrierBoxes(barrierPlacements(v, dropFlags(2))), 0, 0)).toBe(false);
    // This build is v1: both stand.
    expect(DROPS.mountain).toBe(false);
    expect(islandOf(v).standable(0, 0)).toBe(false);
  });

  it("closes the village's ruins gate with rubble until the ruins open: wider than the gate, clear of its exit", () => {
    const v = village(), gate = v.objects.find(o => o.kind === "landmark" && o.id === "ruins")!;
    const rubble = barrierPlacements(v, dropFlags(1)).find(b => b.id === "ruins-gate")!;
    expect(rubble).toMatchObject({ model: "ruins-rubble", x: gate.x, z: gate.z });
    expect(barrierPlacements(v, dropFlags(3)).some(b => b.id === "ruins-gate")).toBe(false);
    const island = islandOf(v);
    // Past the gate landmark's own 0.4 half width, still inside the rubble: blocked; the exit spot (1.6 toward the village) is free.
    expect(island.standable(gate.x - 0.8, gate.z)).toBe(false);
    expect(island.standable(gate.x, gate.z + 1.7)).toBe(false);
    expect(island.standable(gate.x - 1.6, gate.z)).toBe(true);
  });

  it("covers its model on the ground: you can't walk into a rock you can see", () => {
    for (const model of BARRIER_MODELS) {
      const b = glbBounds(model), f = barrierFootprint(model)!;
      // Within a body's half width (0.3) of every visible edge.
      expect(f.cx - f.hw, `${model} -x`).toBeLessThan(b.x0 + 0.3);
      expect(f.cx + f.hw, `${model} +x`).toBeGreaterThan(b.x1 - 0.3);
      expect(f.cz - f.hd, `${model} -z`).toBeLessThan(b.z0 + 0.3);
      expect(f.cz + f.hd, `${model} +z`).toBeGreaterThan(b.z1 - 0.3);
    }
  });

  it("is a map object the file keeps, with a footprint the painter draws", () => {
    const doc = serialiseVillage(createCenteredMap(4, 4), [{ id: "slide", kind: "barrier", model: "rockslide", x: 1, z: 1, yaw: 0.5 }]);
    expect(parseVillage(doc).objects).toEqual([{ id: "slide", kind: "barrier", model: "rockslide", x: 1, z: 1, yaw: 0.5 }]);
    expect(objectFootprint({ id: "slide", kind: "barrier", model: "rockslide", x: 1, z: 1 })).toEqual(barrierFootprint("rockslide"));
  });

  /**
   * A flood over the game's own walker (island.move, 0.5-unit steps, 8 directions) inside a window, from `start`: every
   * spot it can walk to. A barrier with a gap a body fits through shows up as ground beyond it.
   */
  function flood(island: ReturnType<typeof islandOf>, start: [number, number], win: { x0: number; x1: number; z0: number; z1: number }, step = 0.5) {
    const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
    const seen = new Set([key(...start)]), queue: [number, number][] = [start], out: [number, number][] = [];
    while (queue.length) {
      const [x, z] = queue.pop()!;
      out.push([x, z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx * step, nz = z + dz * step, k = key(nx, nz);
        if (seen.has(k) || nx < win.x0 || nx > win.x1 || nz < win.z0 || nz > win.z1) continue;
        const [ax, az] = island.move(x, z, nx, nz);
        if (Math.hypot(ax - nx, az - nz) > 0.02) continue;
        seen.add(k);
        queue.push([nx, nz]);
      }
    }
    return out;
  }
  const worldDoc = () => JSON.parse(readFileSync(join(__dirname, "../../data/world-map.json"), "utf8")) as VillageDoc;
  const proposed = (proposal as { objects: MapObject[] }).objects.map(({ id, kind, model, x, z, yaw, scale }) => ({ id, kind, model, x, z, yaw, ...(scale ? { scale } : {}) }));

  it("with the proposal accepted, the walker can't climb the mountain trail past the rockslide (and can without it)", () => {
    const world = buildVillage(worldDoc()), m = world.map;
    // Off the cell corners (the height field there is the higher cell's), measured by the cell's level.
    const win = { x0: -36, x1: -14, z0: -104, z1: -84 }, start: [number, number] = [-26.25, -88.25];
    const highest = (island: ReturnType<typeof islandOf>) => Math.max(...flood(island, start, win).map(([x, z]) => levelAt(m, worldToCellX(m, x), worldToCellZ(m, z))));
    expect(highest(islandOf(world))).toBeGreaterThanOrEqual(4);
    expect(highest(islandOf(villageOf(m, [...world.objects, ...proposed])))).toBeLessThan(4);
  }, 60_000);

  it("with the proposal accepted, the forest ring and the rubble close the ruins: nobody walks from the path into the middle", () => {
    const world = buildVillage(worldDoc());
    const island = islandOf(villageOf(world.map, [...world.objects, ...proposed]));
    const reached = flood(island, [48, -16], { x0: 12, x1: 84, z0: -88, z1: -14 }, 0.75);
    expect(reached.length).toBeGreaterThan(400);
    expect(reached.some(([x, z]) => Math.hypot(x - 48, z + 52) < 26)).toBe(false);
  }, 60_000);

  it("the proposal places every barrier on the v2 world, on dry land, each a known model with a unique id", () => {
    const world = buildVillage(JSON.parse(readFileSync(join(__dirname, "../../data/world-map.json"), "utf8")) as VillageDoc);
    const items = (proposal as { objects: MapObject[] }).objects;
    expect(new Set(items.map(o => o.model))).toEqual(new Set(BARRIER_MODELS));
    expect(new Set(items.map(o => o.id)).size).toBe(items.length);
    const taken = new Set(world.objects.map(o => `${o.kind}:${o.id}`));
    for (const o of items) {
      expect(o.kind).toBe("barrier");
      expect(taken.has(`barrier:${o.id}`), o.id).toBe(false);
      expect(islandOf(world).wet(o.x, o.z), `${o.id} on land`).toBe(false);
    }
  });
});
