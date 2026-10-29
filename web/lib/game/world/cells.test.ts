/**
 * The server's cell view of the smooth world (cells.ts) stays in step with the world files, and gives the server the
 * client's casts and nodes exactly (lib/collections/rolls.ts checks catches against it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { villageBottleSpot, villageNodes } from "../islandNodes";
import { fishingSpot, villageWater, WATER_CLASS } from "../fishingSpots";
import type { MapObject } from "../villageMap";
import { cellsMap, villageOfCells, worldCells, worldCellsJson, type WorldCells } from "./cells";
import { loadWorldFromDisk } from "./disk";
import { cellMapOf } from "./terrain";
import { villageOfWorld } from "./village";
import { BENCH_SEAT_TOP, PROP_FOOTPRINT, PROP_TOP, propsOf } from "../defaultIsland";

const dir = fileURLToPath(new URL("../../../data/world/", import.meta.url));
const world = loadWorldFromDisk(dir);
const committed = JSON.parse(readFileSync(join(dir, "cells.json"), "utf8")) as WorldCells;

describe("the world's cell view for the server", () => {
  it("is in sync with the world files (after a merge: cd web && npx vite-node -c vitest.config.ts scripts/world-cells.ts)", () => {
    expect(readFileSync(join(dir, "cells.json"), "utf8")).toBe(worldCellsJson(worldCells(cellMapOf(world.terrain))));
  });

  it("decodes to the cells it was coded from", () => {
    expect(worldCells(cellsMap(committed))).toEqual(committed);
  });

  it("gives the server the client's water classes, casts and node ids, with nodes placed anywhere", () => {
    const wharf = world.objects.find(o => o.kind === "landmark" && o.id === "wharf")!;
    // Nodes of every kind the file can place, scattered over land and shore (the shipped world has none yet).
    const extra: MapObject[] = [];
    for (let i = 0; i < 40; i++) {
      const x = wharf.x - 60 + (i * 37) % 120, z = wharf.z - 40 + (i * 53) % 80;
      extra.push({ id: `t${i}`, kind: (["tree", "flower", "rock", "shell"] as const)[i % 4], x, z, seed: i });
      extra.push({ id: `b${i}`, kind: "bug", model: i % 2 ? "water_edge" : "ground", x: x + 0.5, z: z + 0.5 });
    }
    const objects = [...world.objects, ...extra];
    const client = villageOfWorld({ terrain: world.terrain, objects, annotations: world.annotations }), server = villageOfCells(committed, objects, world.annotations);
    expect(server.map.width).toBe(client.map.width);
    expect(villageWater(server).classes).toEqual(villageWater(client).classes);
    const ids = (v: typeof client) => { const n = villageNodes(v); return [...n.forage, ...n.bugs].map(({ id, x, z }) => [id, x, z]); };
    expect(ids(server)).toEqual(ids(client));
    expect(ids(client).length).toBeGreaterThan(20);
    for (let i = 0; i < 400; i++) {
      const x = wharf.x - 40 + (i % 20) * 4.1, z = wharf.z - 40 + Math.floor(i / 20) * 4.3;
      expect(fishingSpot(server.map, villageWater(server).classify, x, z), `${x}, ${z}`).toEqual(fishingSpot(client.map, villageWater(client).classify, x, z));
    }
  });

  it("fishes the river as river where it opens to the sea, and washes the message bottle up on the beach", () => {
    const v = villageOfCells(committed, world.objects, world.annotations), { classes } = villageWater(v);
    const river = world.annotations.find(a => a.name === "River")!.cells;
    expect(river.length).toBeGreaterThan(1000);
    expect(river.filter(([cx, cz]) => classes[cz * v.map.width + cx] !== WATER_CLASS.river)).toEqual([]);
    const bottles = new Set(["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map(d => String(villageBottleSpot(d, v))));
    expect(bottles.size).toBeGreaterThanOrEqual(2);
    for (const b of bottles) expect(Number(b.split(",")[1])).toBeGreaterThan(100);
  });
});

describe("the plaza benches", () => {
  it("draw our plaza bench where the map gives a bench no model, solid, its seat at the sit height", () => {
    const benches = propsOf(villageOfWorld(world)).filter(o => o.kind === "bench" && /^bench-\d$/.test(o.id));
    expect(benches.length).toBe(4);
    for (const b of benches) expect(b.model).toBe("plaza-bench");
    expect(PROP_FOOTPRINT["plaza-bench"]).toBeDefined();
    expect(PROP_TOP["plaza-bench"]).toBe(BENCH_SEAT_TOP);
    expect(propsOf(villageOfWorld(world)).find(o => o.id === "fire-bench-0")?.model).toBe("log-bench");
  });
});
