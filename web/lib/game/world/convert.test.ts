/**
 * The conversion of the v2 cell world (specs/world-editor.md v0 step 2), checked on the real web/data/world-map.json:
 * what David drew is kept (coast, rivers, paths, objects, annotations), what he saw is fixed (no holes, no stepped
 * edges, natural depth), and cliffs stay only where the old map drew kit cliffs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CLIFF_LEVELS, Surface, isWater, needsCliff, type IslandMap } from "../grid";
import { landmarkHalf, turn, type LandmarkId } from "../defaultIsland";
import { parseVillage, type VillageDoc } from "../villageMap";
import { berthWeight, convertCells, shelf } from "./convert";
import type { World } from "./format";
import { MAX_CLIMB, Paint, paintAt, sampleX, sampleZ, terrainHeight, terrainSteepness, type WorldTerrain } from "./terrain";

const doc = JSON.parse(readFileSync(join(__dirname, "../../../data/world-map.json"), "utf8")) as VillageDoc;
let world: World, t: WorldTerrain, old: IslandMap;

beforeAll(() => {
  world = convertCells(doc).world;
  t = world.terrain;
  old = parseVillage(doc).map;
}, 60_000);

const centre = (cx: number, cz: number): [number, number] => [old.originX + cx, old.originZ + cz];

describe("converting the v2 world", () => {
  it("keeps the grid, the objects and the annotations exactly", () => {
    expect([t.width, t.depth, t.originX, t.originZ]).toEqual([doc.width, doc.depth, doc.originX, doc.originZ]);
    expect(world.objects).toEqual(parseVillage(doc).objects);
    expect(world.annotations).toEqual(parseVillage(doc).annotations);
  });

  it("keeps the coast and the rivers: sea-level water stays water, land stays land (cell centres)", () => {
    let wrong = 0, water = 0;
    const docks = world.objects.filter(o => o.kind === "landmark" && o.id === "wharf");
    for (let cz = 0; cz < old.depth; cz++) for (let cx = 0; cx < old.width; cx++) {
      const s = old.surfaces[cz * old.width + cx], lv = old.levels[cz * old.width + cx];
      if (isWater(s) && lv > 1) continue; // the waterfall's channel: dried to rock in v0
      if (docks.some(d => berthWeight(d, ...centre(cx, cz)) > 0)) continue; // the wharf's berth, dug for the boats
      const h = terrainHeight(t, ...centre(cx, cz)), wet = isWater(s);
      if (wet) water++;
      if (wet !== h <= t.seaLevel) wrong++;
    }
    expect(water).toBeGreaterThan(150_000);
    expect(wrong).toBe(0);
  });

  it("has no holes and no walls: neighbouring samples never jump more than a steep face can", () => {
    let worst = 0, broken = 0;
    for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
      const p = k * t.cols + i, h = t.heights[p];
      if (i + 1 < t.cols) worst = Math.max(worst, Math.abs(t.heights[p + 1] - h));
      if (k + 1 < t.rows) worst = Math.max(worst, Math.abs(t.heights[p + t.cols] - h));
      if (!Number.isFinite(h)) broken++;
    }
    expect(broken).toBe(0);
    // The old cliffs were 1.5 u of vertical wall with nothing between two cells; now every face is ground, at most 3
    // grade (1.5 between samples half a unit apart), however many old tiers stacked there.
    expect(worst).toBeLessThan(1.5 + 0.01);
  });

  it("keeps cliffs only where the old map drew kit cliffs (or a cliff meets the sea)", () => {
    // Every land sample too steep to climb lies within 2.5 cells of an old kit cliff or an old level-2+ coast.
    const near = new Uint8Array(old.width * old.depth);
    for (let cz = 0; cz < old.depth; cz++) for (let cx = 0; cx < old.width; cx++) {
      const c = cz * old.width + cx;
      let mark = needsCliff(old, cx, cz) || (isWater(old.surfaces[c]) && old.levels[c] > 1);
      if (!mark && !isWater(old.surfaces[c]) && old.levels[c] >= CLIFF_LEVELS) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (cz + dz) * old.width + cx + dx; if (isWater(old.surfaces[n])) mark = true; }
      }
      if (!mark) continue;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const nx = cx + dx, nz = cz + dz;
        if (nx >= 0 && nz >= 0 && nx < old.width && nz < old.depth && Math.hypot(dx, dz) <= 2.5) near[nz * old.width + nx] = 1;
      }
    }
    let steep = 0, stray = 0;
    for (let k = 1; k < t.rows - 1; k += 1) for (let i = 1; i < t.cols - 1; i += 1) {
      const x = sampleX(t, i), z = sampleZ(t, k);
      if (terrainHeight(t, x, z) <= t.seaLevel + 0.05 || terrainSteepness(t, x, z) <= MAX_CLIMB) continue;
      steep++;
      const cx = Math.round(x - old.originX), cz = Math.round(z - old.originZ);
      if (!near[Math.min(old.depth - 1, Math.max(0, cz)) * old.width + Math.min(old.width - 1, Math.max(0, cx))]) stray++;
    }
    expect(steep).toBeGreaterThan(500); // the mountain's tiers are still cliffs
    expect(stray / steep).toBeLessThan(0.02);
  });

  it("turns every one-level step into a walkable slope", () => {
    // Land samples whose cell and all its neighbours are at most one level apart (an old slope or flat) are walkable, with
    // room to spare (two old one-level steps a cell apart make the steepest of them, about 0.7).
    let checked = 0, tooSteep = 0;
    for (let cz = 2; cz < old.depth - 2; cz += 2) for (let cx = 2; cx < old.width - 2; cx += 2) {
      const c = cz * old.width + cx;
      if (isWater(old.surfaces[c])) continue;
      let gentle = true;
      for (let dz = -2; dz <= 2 && gentle; dz++) for (let dx = -2; dx <= 2; dx++) {
        const n = (cz + dz) * old.width + cx + dx;
        if (isWater(old.surfaces[n]) || Math.abs(old.levels[n] - old.levels[c]) > 1) { gentle = false; break; }
      }
      if (!gentle) continue;
      checked++;
      if (terrainSteepness(t, ...centre(cx, cz)) > 0.8 * MAX_CLIMB) tooSteep++;
    }
    expect(checked).toBeGreaterThan(5000);
    expect(tooSteep).toBe(0);
  });

  it("shelves the coast gently under the water", () => {
    // Just off the shore the water is shallow (the old bed dropped 0.8 in the first unit), and the open sea reaches the deep floor.
    expect(shelf(1)).toBeLessThan(0.3);
    expect(shelf(2)).toBeLessThan(0.5);
    expect(shelf(40)).toBeCloseTo(4.2, 1);
    let deepest = 0;
    for (const h of t.heights) deepest = Math.max(deepest, t.seaLevel - h);
    expect(deepest).toBeCloseTo(4.2, 1);
  });

  it("raises a quay at the wharf: the bank at the deck's height, deep water under the jetty and the moorings (David, 2026-10-14)", () => {
    const w = world.objects.find(o => o.kind === "landmark" && o.id === "wharf")!;
    const at = (dx: number, dz: number) => { const [x, z] = turn(dx, dz, w.yaw); return terrainHeight(t, w.x + x, w.z + z); };
    // The jetty's land end and the ground beside it stand at the deck (y 0), not down a beach.
    for (const [dx, dz] of [[0, 1.1], [-1.5, 0.8], [1.5, 0.8], [0, 0.3]]) {
      const h = at(dx, dz);
      if (h > t.seaLevel) expect(h, `bank at ${dx},${dz}`).toBeGreaterThan(-0.01);
    }
    // The tip, the moored boat (lib/game/wharf.ts MOORED) and the rowboats along the finger float over deep water.
    for (const [dx, dz] of [[0, -3.5], [2.32, -2.92], [-2.65, -3.97], [-3.75, -1.8]]) expect(t.seaLevel - at(dx, dz), `depth at ${dx},${dz}`).toBeGreaterThan(1.2);
  });

  it("keeps the gentle shelf on the beaches away from the wharf", () => {
    // The beach landmark's shore: walk out from it until the water starts, then two units on, the sea is still shallow.
    const b = world.objects.find(o => o.kind === "landmark" && o.id === "beach")!;
    let shelves = 0;
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos((a / 16) * Math.PI * 2), dz = Math.sin((a / 16) * Math.PI * 2);
      let s = 0;
      while (s < 40 && terrainHeight(t, b.x + dx * s, b.z + dz * s) > t.seaLevel) s += 0.1;
      if (s >= 40) continue;
      const depth = t.seaLevel - terrainHeight(t, b.x + dx * (s + 2), b.z + dz * (s + 2));
      if (paintAt(t, b.x + dx * (s - 0.5), b.z + dz * (s - 0.5)) !== Paint.Sand) continue;
      expect(depth).toBeLessThan(0.6);
      shelves++;
    }
    expect(shelves).toBeGreaterThan(3);
  });

  it("carries the paths, the beach and the plaza's stone into the paint", () => {
    const share = (s: number, paint: number) => {
      let n = 0, ok = 0;
      for (let cz = 0; cz < old.depth; cz++) for (let cx = 0; cx < old.width; cx++) {
        if (old.surfaces[cz * old.width + cx] !== s) continue;
        const [x, z] = centre(cx, cz);
        if (terrainHeight(t, x, z) <= t.seaLevel) continue;
        n++;
        if (paintAt(t, x, z) === paint) ok++;
      }
      return ok / n;
    };
    expect(share(Surface.Soil, Paint.Path)).toBeGreaterThan(0.85);
    expect(share(Surface.Sand, Paint.Sand)).toBeGreaterThan(0.85);
    expect(share(Surface.Stone, Paint.Stone)).toBeGreaterThan(0.85);
  });

  it("stands every building on a flat pad", () => {
    let pads = 0;
    for (const o of world.objects) {
      const half = o.kind === "landmark" ? landmarkHalf(o.id as LandmarkId, o.yaw ?? 0, o.scale ?? 1) : null;
      if (!half) continue;
      pads++;
      const base = terrainHeight(t, o.x, o.z);
      for (let a = -1; a <= 1; a += 0.25) for (let b = -1; b <= 1; b += 0.25) {
        expect(Math.abs(terrainHeight(t, o.x + a * half[0], o.z + b * half[1]) - base)).toBeLessThan(0.02);
      }
    }
    expect(pads).toBeGreaterThanOrEqual(6);
  });
});
