import { describe, expect, it } from "vitest";
import { Surface } from "../grid";
import { decodeWorld, dequantise, encodeWorld, fromBase64, quantise, quantiseTerrain, toBase64, worldDocOf, worldDocProblem, type World, type WorldDoc } from "./format";
import {
  Paint, cellMapOf, createTerrain, heightAtSample, paintWeight, sampleX, sampleZ, terrainHeight, terrainShoreField, terrainSurface, type WorldTerrain,
} from "./terrain";

/** A small world with a hill, a beach, a path, a pond under the sea and some objects. */
function sample(): World {
  const t = createTerrain(24, 18, -12, -9);
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k), r = Math.hypot(x - 2, z + 1);
    t.heights[k * t.cols + i] = 3 * Math.exp(-(r * r) / 30) - 0.9 + 0.13 * Math.sin(x * 1.7) * Math.cos(z * 0.9);
    t.paint[k * t.cols + i] = r > 9 ? Paint.Sand : Math.abs(x + 4) < 1 ? Paint.Path : r < 1.5 ? Paint.Rock : Paint.Grass;
  }
  return {
    terrain: t,
    objects: [
      { id: "hq", kind: "landmark", x: 1, z: 0, yaw: -1.51, scale: 1.15 },
      { id: "tree-0", kind: "tree", x: -3.5, z: 2.25, seed: 7 },
      { id: "default", kind: "spawn", x: 0, z: -4 },
    ],
    annotations: [{ name: "Village", color: "#C98F73", cells: [[3, 4], [4, 4]] }],
    source: "test",
  };
}

const decodeFiles = (f: ReturnType<typeof encodeWorld>) => decodeWorld(JSON.parse(f.json) as WorldDoc, f.height, f.surface);

describe("world files", () => {
  it("load then save gives the same bytes (heights, paint, objects, annotations)", () => {
    const once = encodeWorld(sample());
    const twice = encodeWorld(decodeFiles(once));
    expect(twice.json).toBe(once.json);
    expect(Buffer.from(twice.height).equals(Buffer.from(once.height))).toBe(true);
    expect(Buffer.from(twice.surface).equals(Buffer.from(once.surface))).toBe(true);
  });

  it("keeps every height to within half a 16-bit step and every paint exactly", () => {
    const w = sample(), back = decodeFiles(encodeWorld(w));
    const step = (w.terrain.heightRange[1] - w.terrain.heightRange[0]) / 65535;
    let worst = 0;
    for (let i = 0; i < w.terrain.heights.length; i++) worst = Math.max(worst, Math.abs(back.terrain.heights[i] - w.terrain.heights[i]));
    expect(worst).toBeLessThanOrEqual(step / 2 + 1e-6);
    expect(Array.from(back.terrain.paint)).toEqual(Array.from(w.terrain.paint));
    expect(back.objects).toEqual(w.objects);
    expect(back.annotations).toEqual(w.annotations);
    expect(back.terrain.seaLevel).toBe(w.terrain.seaLevel);
  });

  it("a quantised terrain survives a round trip exactly", () => {
    const w = sample();
    quantiseTerrain(w.terrain);
    const back = decodeFiles(encodeWorld(w));
    expect(Array.from(back.terrain.heights)).toEqual(Array.from(w.terrain.heights));
    for (const h of [-12, -0.078, 0, 0.75, 6, 35.99]) expect(Math.abs(dequantise(quantise(h, [-12, 36]), [-12, 36]) - h)).toBeLessThan(4e-4);
  });

  it("refuses malformed documents and images, naming the problem", () => {
    const f = encodeWorld(sample()), doc = JSON.parse(f.json) as WorldDoc;
    expect(worldDocProblem(doc)).toBeNull();
    expect(() => decodeWorld({ ...doc, version: 2 }, f.height, f.surface)).toThrow(/version/);
    expect(() => decodeWorld({ ...doc, width: doc.width + 1 }, f.height, f.surface)).toThrow(/height\.png is/);
    expect(() => decodeWorld(doc, f.surface, f.height)).toThrow(/16-bit/);
    expect(() => decodeWorld({ ...doc, surfaces: ["grass"] }, f.height, f.surface)).toThrow(/paint/);
  });

  it("base64 carries the images through JSON unchanged", () => {
    const f = encodeWorld(sample());
    expect(Buffer.from(fromBase64(toBase64(f.height))).equals(Buffer.from(f.height))).toBe(true);
  });

  it("documents the grid it was written with", () => {
    const doc = worldDocOf(sample());
    expect(doc).toMatchObject({ format: "tethos-world", version: 1, width: 24, depth: 18, originX: -12, originZ: -9, resolution: 2, surfaces: ["grass", "sand", "path", "rock", "stone"] });
  });
});

describe("the ground", () => {
  const t: WorldTerrain = sample().terrain;

  it("passes through every sample and is continuous across quads (no cracks)", () => {
    for (let k = 0; k < t.rows; k += 3) for (let i = 0; i < t.cols; i += 5) {
      expect(terrainHeight(t, sampleX(t, i), sampleZ(t, k))).toBeCloseTo(heightAtSample(t, i, k), 5);
    }
    // Walk a line through many quads in tiny steps: the height never jumps.
    let prev = terrainHeight(t, -11.9, -8.7), worst = 0;
    for (let s = 1; s <= 4000; s++) {
      const x = -11.9 + s * 0.0058, z = -8.7 + s * 0.0041, h = terrainHeight(t, x, z);
      worst = Math.max(worst, Math.abs(h - prev));
      prev = h;
    }
    expect(worst).toBeLessThan(0.02);
  });

  it("splits each quad along the renderer's diagonal", () => {
    const tt = createTerrain(2, 2, 0, 0, { res: 1 });
    // One quad with only its far corner raised: on the (i, k)–(i+1, k+1) diagonal the midpoint is half of it.
    tt.heights[1 * tt.cols + 1] = 2;
    expect(terrainHeight(tt, -0.5 + 0.5, -0.5 + 0.5)).toBeCloseTo(1, 6);
    expect(terrainHeight(tt, -0.5 + 0.9, -0.5 + 0.1)).toBeCloseTo(0.2, 6);
  });

  it("reads paint as soft weights between samples", () => {
    const tt = createTerrain(2, 2, 0, 0, { res: 1 });
    tt.paint[0] = Paint.Path;
    expect(paintWeight(tt, Paint.Path, -0.5, -0.5)).toBe(1);
    expect(paintWeight(tt, Paint.Path, 0, -0.5)).toBeCloseTo(0.5, 6);
    expect(paintWeight(tt, Paint.Path, 0.5, 0.5)).toBe(0);
  });

  it("the cell view puts water where the ground is under the sea", () => {
    const map = cellMapOf(t);
    for (let cz = 0; cz < t.depth; cz++) for (let cx = 0; cx < t.width; cx++) {
      const h = terrainHeight(t, t.originX + cx, t.originZ + cz), s = map.surfaces[cz * t.width + cx];
      expect(s === Surface.River).toBe(h <= t.seaLevel);
    }
    expect(terrainSurface(t, 2, -1)).toBe(Surface.Stone); // the rock at the peak
  });

  it("the water's field is positive over water, crosses 0 at the drawn shore, and its depth is the real seabed's", () => {
    const f = terrainShoreField(t);
    let checked = 0;
    for (let j = 0; j < f.height; j += 3) for (let i = 0; i < f.width; i += 3) {
      const x = f.minX + (i + 0.5) / f.scale, z = f.minZ + (j + 0.5) / f.scale, h = terrainHeight(t, x, z), k = j * f.width + i;
      if (Math.abs(h - t.seaLevel) < 1e-3) continue;
      expect(f.data[k] > 0).toBe(h < t.seaLevel);
      if (h < t.seaLevel) expect(f.depth[k]).toBeCloseTo(t.seaLevel - h, 4);
      else expect(f.depth[k]).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
