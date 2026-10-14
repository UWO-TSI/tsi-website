/**
 * The committed world files (web/data/world/): whatever David sculpts into them, they load, they save back to the
 * same bytes, and the village still stands on dry land. The conversion's own checks are convert.test.ts.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landmarkHalf, type LandmarkId } from "../defaultIsland";
import { readWorldFiles } from "./disk";
import { decodeWorld, encodeWorld } from "./format";
import { terrainHeight } from "./terrain";
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

  it("become a village that draws and walks the heightfield", () => {
    const v = villageOfWorld(world);
    expect(groundKind(v)).toBe("heightfield");
    expect(v.map.width).toBe(world.terrain.width);
    expect(v.objects).toBe(world.objects);
  });
});
