import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FENCE_POST_HALF, FENCE_POST_URL, FENCE_RAIL_URL, FENCE_TOP, FENCE_MODELS, JOINED_FENCE, fenceLayout, fencePlacements, fenceShapes, fenceSolids,
  isJoinedFence,
} from "./fences";
import { createCenteredMap, setCell, Surface } from "./grid";
import { islandOf, objectFootprint } from "./defaultIsland";
import { villageOf, type MapObject } from "./villageMap";
import { readGlb } from "./perf/glbStats";

const pts = (...xz: [number, number][]) => xz.map(([x, z]) => ({ x, z }));
const fence = (x: number, z: number, i: number, model = JOINED_FENCE): MapObject => ({ id: `fence-${i}`, kind: "fence", x, z, model });

describe("the connectable fence (lib/game/fences.ts): posts join their side-by-side neighbours, Minecraft-style", () => {
  it("joins a straight run: a post on every cell, a rail between each two, ends and straights", () => {
    const run = pts([0, 0], [1, 0], [2, 0]);
    const { posts, rails } = fenceLayout(run);
    expect(posts).toHaveLength(3);
    expect(rails.map(r => [r.x, r.z, r.yaw])).toEqual([[0.5, 0, 0], [1.5, 0, 0]]);
    expect(fenceShapes(run)).toEqual(["end", "straight", "end"]);
  });
  it("turns corners and makes tees and crosses; a post alone stands alone", () => {
    expect(fenceShapes(pts([0, 0], [1, 0], [1, 1]))).toEqual(["end", "corner", "end"]);
    expect(fenceShapes(pts([0, 0], [1, 0], [2, 0], [1, 1]))[1]).toBe("tee");
    expect(fenceShapes(pts([1, 1], [0, 1], [2, 1], [1, 0], [1, 2]))[0]).toBe("cross");
    expect(fenceShapes(pts([5, 5]))).toEqual(["post"]);
    const corner = fenceLayout(pts([0, 0], [1, 0], [1, 1]));
    expect(corner.rails.map(r => [r.x, r.z, r.yaw])).toEqual([[0.5, 0, 0], [1, 0.5, Math.PI / 2]]);
  });
  it("never joins diagonally, two cells apart, or a post to itself twice", () => {
    expect(fenceLayout(pts([0, 0], [1, 1])).rails).toHaveLength(0);
    expect(fenceLayout(pts([0, 0], [2, 0])).rails).toHaveLength(0);
    const twice = fenceLayout(pts([0, 0], [0, 0], [1, 0]));
    expect(twice.posts).toHaveLength(2);
    expect(twice.rails).toHaveLength(1);
  });
  it("joins posts a hair off the grid (a hand-typed position), not ones half a cell off", () => {
    expect(fenceLayout(pts([0, 0], [1.03, -0.02])).rails).toHaveLength(1);
    expect(fenceLayout(pts([0, 0], [1.5, 0])).rails).toHaveLength(0);
  });
  it("is solid along its rails and at its posts, and open between posts that don't join", () => {
    const solids = fenceSolids(pts([0, 0], [1, 0], [1, 1], [3, 0]));
    const blocked = (x: number, z: number) => solids.some(s => {
      const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), n = Math.sin(s.yaw);
      return Math.abs(dx * c - dz * n) < s.hw && Math.abs(dx * n + dz * c) < s.hd;
    });
    expect(blocked(0.5, 0)).toBe(true);
    expect(blocked(1, 0.5)).toBe(true);
    expect(blocked(0, 0)).toBe(true);
    expect(blocked(2, 0)).toBe(false);
    expect(blocked(0.5, 0.4)).toBe(false);
    expect(Math.max(...solids.map(s => s.top))).toBeCloseTo(FENCE_TOP, 2);
  });
  it("walks into a fence line and not through it on the island; a gap in the line lets you by", () => {
    const map = createCenteredMap(20, 20);
    for (let cz = 0; cz < 20; cz++) for (let cx = 0; cx < 20; cx++) setCell(map, cx, cz, 0, Surface.Grass);
    const line = [-3, -2, -1, 0, 1, 2, 3].map((x, i) => fence(x, 0, i));
    const island = islandOf(villageOf(map, line));
    expect(island.standable(0.5, 0)).toBe(false);
    expect(island.move(0.5, -2, 0.5, 2)[1]).toBeLessThan(0);
    const gapped = islandOf(villageOf(map, line.filter(o => o.x !== 0 && o.x !== 1)));
    expect(gapped.move(0.5, -2, 0.5, 2)[1]).toBeGreaterThan(1.5);
  });
  it("places a post per cell and a rail per join, the rails at their posts' mean ground", () => {
    const items = fencePlacements(pts([0, 0], [1, 0]), (x) => x);
    expect(items.filter(i => i.url === FENCE_POST_URL).map(i => i.position)).toEqual([[0, 0, 0], [1, 1, 0]]);
    expect(items.filter(i => i.url === FENCE_RAIL_URL).map(i => i.position)).toEqual([[0.5, 0.5, 0]]);
  });
  it("is the palettes' fence, picked and drawn by its post", () => {
    expect(FENCE_MODELS[0]).toBe(JOINED_FENCE);
    expect(isJoinedFence(fence(0, 0, 0))).toBe(true);
    expect(isJoinedFence(fence(0, 0, 0, "fence-country-a"))).toBe(false);
    expect(objectFootprint(fence(0, 0, 0))).toEqual({ hw: FENCE_POST_HALF, hd: FENCE_POST_HALF, cx: 0, cz: 0 });
  });
  it("ships its post and rail: the post as tall as FENCE_TOP inside its footprint, the rail one cell from post to post", () => {
    const pub = join(__dirname, "../../public");
    const bounds = (url: string) => {
      expect(existsSync(join(pub, url)), url).toBe(true);
      const gltf = readGlb(new Uint8Array(readFileSync(join(pub, url)))).json as unknown as { accessors: { min?: number[]; max?: number[] }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[] };
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const m of gltf.meshes) for (const p of m.primitives) {
        const a = gltf.accessors[p.attributes.POSITION];
        for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min![i]); max[i] = Math.max(max[i], a.max![i]); }
      }
      return { min, max };
    };
    const post = bounds(FENCE_POST_URL), rail = bounds(FENCE_RAIL_URL);
    expect(post.max[1]).toBeCloseTo(FENCE_TOP, 2);
    for (const i of [0, 2]) expect(Math.max(-post.min[i], post.max[i])).toBeLessThanOrEqual(FENCE_POST_HALF);
    expect(rail.min[0]).toBeCloseTo(-0.5, 2);
    expect(rail.max[0]).toBeCloseTo(0.5, 2);
    expect(rail.max[1]).toBeLessThan(FENCE_TOP);
  });
});
