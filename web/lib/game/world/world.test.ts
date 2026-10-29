/**
 * The committed world files (web/data/world/): whatever David sculpts into them, they load, they save back to the
 * same bytes, and the village still stands on dry land. The conversion's own checks are convert.test.ts.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROP_FOOTPRINT, landmarkHalf, type LandmarkId } from "../defaultIsland";
import { readWorldFiles } from "./disk";
import { decodeWorld, encodeWorld } from "./format";
import { PLAZA } from "./generate";
import { Paint, paintAt, terrainHeight } from "./terrain";
import { groundKind, villageOfWorld } from "./village";

const DIR = join(__dirname, "../../../data/world");

describe("the committed world files", () => {
  const files = readWorldFiles(DIR);
  const world = decodeWorld(files.doc, files.height, files.surface);

  it("load and save back to the same bytes", () => {
    const again = encodeWorld(world);
    expect(again.json).toBe(files.json);
    expect(Buffer.from(again.height).equals(Buffer.from(files.height))).toBe(true);
    expect(Buffer.from(again.surface).equals(Buffer.from(files.surface))).toBe(true);
  });

  it("stand the village's spawn, plaza and buildings on dry land", () => {
    const t = world.terrain, ids = new Set(world.objects.map(o => `${o.kind}:${o.id}`));
    for (const id of ["spawn:default", "landmark:plaza", "landmark:hq", "landmark:shop", "landmark:cafe", "landmark:museum"]) expect(ids.has(id), id).toBe(true);
    for (const o of world.objects) {
      if (o.kind === "landmark" && o.id === "wharf") continue; // the jetty stands in the water
      if (o.kind !== "landmark" && o.kind !== "spawn") continue;
      expect(terrainHeight(t, o.x, o.z), `${o.kind}:${o.id}`).toBeGreaterThan(t.seaLevel + 0.02);
      const half = o.kind === "landmark" ? landmarkHalf(o.id as LandmarkId, o.yaw ?? 0, o.scale ?? 1) : null;
      if (half) expect(terrainHeight(t, o.x + half[0], o.z - half[1]), `${o.id} pad`).toBeCloseTo(terrainHeight(t, o.x, o.z), 1);
    }
  });

  // David, round 3: "make sure the bench location and orientation is fitting" (bench-0 sat across the paving).
  it("seat the plaza benches at the plaza's edge, along it, facing the fountain, never on a path", () => {
    const [px, pz] = PLAZA.at, [hw, hd] = PROP_FOOTPRINT["plaza-bench"];
    const benches = world.objects.filter(o => o.kind === "bench" && /^bench-\d$/.test(o.id));
    expect(benches).toHaveLength(4);
    for (const b of benches) {
      const yaw = b.yaw ?? 0, dx = px - b.x, dz = pz - b.z, r = Math.hypot(dx, dz);
      expect(r, b.id).toBeGreaterThan(PLAZA.r - 1.2);
      expect(r, b.id).toBeLessThan(PLAZA.r - 0.4);
      // Its front (local +z, where benchSeat faces you from the plaza) at the fountain, so it runs along the edge.
      expect((Math.sin(yaw) * dx + Math.cos(yaw) * dz) / r, b.id).toBeGreaterThan(0.999);
      // The whole seat, and a step in front of it and past its ends, on the plaza's stone: no path, no grass.
      for (const [u, w] of [[-hw, -hd], [hw, -hd], [-hw - 0.5, hd + 0.5], [0, hd + 0.5], [hw + 0.5, hd + 0.5]]) {
        const x = b.x + Math.cos(yaw) * u + Math.sin(yaw) * w, z = b.z - Math.sin(yaw) * u + Math.cos(yaw) * w;
        expect(paintAt(world.terrain, x, z), `${b.id} ${u} ${w}`).toBe(Paint.Stone);
      }
      // Clear of everything stood round the plaza (a body's width past its ends).
      for (const o of world.objects) if (o !== b && o.kind !== "landmark" && o.kind !== "bug") expect(Math.hypot(o.x - b.x, o.z - b.z), `${b.id} ${o.id}`).toBeGreaterThan(1.5);
    }
  });

  it("become a village that draws and walks the heightfield", () => {
    const v = villageOfWorld(world);
    expect(groundKind(v)).toBe("heightfield");
    expect(v.map.width).toBe(world.terrain.width);
    expect(v.objects).toBe(world.objects);
  });
});
