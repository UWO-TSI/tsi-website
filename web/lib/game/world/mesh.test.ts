import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CHUNK_CELLS, LOD_STRIDES, chunkGeometry, chunkRef, chunkSkirts, listChunkRefs, lodFor, refreshChunkGeometry, strideIndices, waterBlocks, waterGeometry,
} from "./mesh";
import { createTerrain, sampleX, sampleZ, terrainHeight, type WorldTerrain } from "./terrain";

/** A rough terrain: hills, a sharp ridge (a cliff a sample wide) and ripples, across 3 × 2 chunks. */
function rough(): WorldTerrain {
  const t = createTerrain(CHUNK_CELLS * 3 - 7, CHUNK_CELLS * 2, 0, 0);
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    t.heights[k * t.cols + i] = 2 * Math.sin(x * 0.21) * Math.cos(z * 0.17) + 0.4 * Math.sin(x * 1.9 + z * 2.3) + (x > 40 + 6 * Math.sin(z * 0.3) ? 2.5 : 0) - 0.6;
  }
  return t;
}

const LODS = LOD_STRIDES.map((_, i) => i);
/** The drawn edge height of a chunk geometry at a world point on its edge: linear between its edge vertices there. */
function edgeY(g: THREE.BufferGeometry, axis: "x" | "z", fixed: number, at: number): number {
  const p = g.getAttribute("position"), pts: [number, number][] = [];
  const { nx, nz } = g.userData.counts as { nx: number; nz: number };
  for (let v = 0; v < nx * nz; v++) {
    const x = p.getX(v), z = p.getZ(v);
    if (axis === "x" ? Math.abs(z - fixed) < 1e-6 : Math.abs(x - fixed) < 1e-6) pts.push([axis === "x" ? x : z, p.getY(v)]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  for (let s = 0; s + 1 < pts.length; s++) if (at >= pts[s][0] - 1e-6 && at <= pts[s + 1][0] + 1e-6) {
    const u = (at - pts[s][0]) / (pts[s + 1][0] - pts[s][0] || 1);
    return pts[s][1] + (pts[s + 1][1] - pts[s][1]) * u;
  }
  throw new Error(`no edge at ${at}`);
}

describe("the ground's chunks", () => {
  const t = rough();

  it("at full detail draw exactly the walker's ground (same triangle split)", () => {
    const c = chunkRef(t, 1, 0), g = chunkGeometry(t, c, 0), p = g.getAttribute("position"), idx = g.getIndex()!;
    const { nx, nz } = g.userData.counts as { nx: number; nz: number };
    const tri = new THREE.Triangle(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), bary = new THREE.Vector3();
    let checked = 0;
    for (let f = 0; f < idx.count; f += 3) {
      const i0 = idx.getX(f), i1 = idx.getX(f + 1), i2 = idx.getX(f + 2);
      if (i0 >= nx * nz || i1 >= nx * nz || i2 >= nx * nz) continue; // skirts
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); d.fromBufferAttribute(p, i2);
      tri.set(a, b, d);
      // The triangle's centroid, on the drawn plane, against the walker's ground.
      const cx = (a.x + b.x + d.x) / 3, cz = (a.z + b.z + d.z) / 3;
      tri.getBarycoord(new THREE.Vector3(cx, 0, cz), bary);
      expect(terrainHeight(t, cx, cz)).toBeCloseTo((a.y + b.y + d.y) / 3, 5);
      // Every ground triangle faces up.
      const n = new THREE.Vector3(); tri.getNormal(n);
      expect(n.y).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBe((nx - 1) * (nz - 1) * 2);
  });

  it("share their edges exactly with a neighbour at the same level of detail (positions and normals)", () => {
    for (const lod of LODS) {
      const a = chunkGeometry(t, chunkRef(t, 0, 0), lod), b = chunkGeometry(t, chunkRef(t, 1, 0), lod);
      const key = (g: THREE.BufferGeometry, v: number) => { const p = g.getAttribute("position"), n = g.getAttribute("normal"); return [p.getX(v), p.getY(v), p.getZ(v), n.getX(v), n.getY(v), n.getZ(v)].map(x => x.toFixed(6)).join(","); };
      const x = sampleX(t, chunkRef(t, 0, 0).i1);
      const edge = (g: THREE.BufferGeometry) => { const { nx, nz } = g.userData.counts; const out = new Set<string>(); for (let v = 0; v < nx * nz; v++) if (Math.abs(g.getAttribute("position").getX(v) - x) < 1e-6) out.add(key(g, v)); return out; };
      expect([...edge(a)].sort()).toEqual([...edge(b)].sort());
    }
  });

  it("leave no gap where two levels of detail meet: every skirt reaches the neighbour's edge", () => {
    for (const refs of [[chunkRef(t, 0, 0), chunkRef(t, 1, 0), "x"], [chunkRef(t, 1, 0), chunkRef(t, 1, 1), "z"], [chunkRef(t, 1, 0), chunkRef(t, 2, 0), "x"]] as const) {
      const [ca, cb, across] = refs;
      // The shared edge: a's high x (b's low x), or a's high z (b's low z).
      const fixed = across === "x" ? sampleX(t, ca.i1) : sampleZ(t, ca.k1);
      const along = across === "x" ? [ca.k0, ca.k1] : [ca.i0, ca.i1];
      const depthA = chunkSkirts(t, ca)[across === "x" ? 3 : 1], depthB = chunkSkirts(t, cb)[across === "x" ? 2 : 0];
      expect(depthA).toBeCloseTo(depthB, 9); // both sides measure the same edge
      for (const la of LODS) for (const lb of LODS) {
        const ga = chunkGeometry(t, ca, la), gb = chunkGeometry(t, cb, lb);
        for (let j = along[0]; j <= along[1]; j++) {
          const at = across === "x" ? sampleZ(t, j) : sampleX(t, j);
          const ya = edgeY(ga, across === "x" ? "z" : "x", fixed, at), yb = edgeY(gb, across === "x" ? "z" : "x", fixed, at);
          // The higher of the two hangs its skirt down past the lower.
          expect(Math.abs(ya - yb)).toBeLessThanOrEqual(depthA + 1e-6);
        }
      }
    }
  });

  it("hang their skirts facing out of the chunk", () => {
    const c = chunkRef(t, 1, 1), g = chunkGeometry(t, c, 2), p = g.getAttribute("position"), idx = g.getIndex()!;
    const { nx, nz } = g.userData.counts as { nx: number; nz: number };
    const mid = new THREE.Vector3(sampleX(t, (c.i0 + c.i1) / 2), 0, sampleZ(t, (c.k0 + c.k1) / 2));
    const tri = new THREE.Triangle(), n = new THREE.Vector3(), ctr = new THREE.Vector3();
    let skirts = 0;
    for (let f = 0; f < idx.count; f += 3) {
      const vs = [idx.getX(f), idx.getX(f + 1), idx.getX(f + 2)];
      if (vs.every(v => v < nx * nz)) continue;
      tri.set(new THREE.Vector3().fromBufferAttribute(p, vs[0]), new THREE.Vector3().fromBufferAttribute(p, vs[1]), new THREE.Vector3().fromBufferAttribute(p, vs[2]));
      tri.getNormal(n); tri.getMidpoint(ctr);
      expect(n.x * (ctr.x - mid.x) + n.z * (ctr.z - mid.z)).toBeGreaterThan(0);
      skirts++;
    }
    expect(skirts).toBeGreaterThan(0);
  });

  it("refresh in place to what a rebuild draws", () => {
    const c = chunkRef(t, 1, 1);
    for (const lod of LODS) {
      const g = chunkGeometry(t, c, lod);
      const tt = { ...t, heights: t.heights.slice() };
      for (let i = 0; i < tt.heights.length; i += 7) tt.heights[i] += 0.3;
      refreshChunkGeometry(tt, c, lod, g);
      const fresh = chunkGeometry(tt, c, lod);
      expect(Array.from(g.getAttribute("position").array)).toEqual(Array.from(fresh.getAttribute("position").array));
      expect(Array.from(g.getAttribute("normal").array)).toEqual(Array.from(fresh.getAttribute("normal").array));
    }
  });

  it("cover a partial last chunk and every sample of the map", () => {
    const seen = new Set<number>();
    for (const c of listChunkRefs(t)) for (let k = c.k0; k <= c.k1; k++) for (let i = c.i0; i <= c.i1; i++) seen.add(k * t.cols + i);
    expect(seen.size).toBe(t.cols * t.rows);
    expect(strideIndices(0, 13, 4)).toEqual([0, 4, 8, 12, 13]);
  });

  it("pick a level of detail by distance, without flickering at the boundary", () => {
    expect(lodFor(10, 0)).toBe(0);
    expect(lodFor(400, 0)).toBe(3);
    expect(lodFor(58, 0)).toBe(0); // just past the boundary: stays
    expect(lodFor(70, 0)).toBe(1);
    expect(lodFor(52, 1)).toBe(1);
    expect(lodFor(40, 1)).toBe(0);
  });
});

describe("the water", () => {
  it("covers every cell whose ground dips under the sea, at the sea level", () => {
    const t = rough();
    let covered = 0, needed = 0;
    for (const b of waterBlocks(t)) {
      const g = waterGeometry(t, b.x0, b.z0, b.x1, b.z1);
      const cells = new Set<string>();
      if (g) {
        const p = g.getAttribute("position"), idx = g.getIndex()!;
        for (let f = 0; f < idx.count; f += 6) {
          const xs = [0, 1, 2].map(j => p.getX(idx.getX(f + j))), zs = [0, 1, 2].map(j => p.getZ(idx.getX(f + j)));
          cells.add(`${Math.floor(Math.min(...xs) - t.x0)},${Math.floor(Math.min(...zs) - t.z0)}`);
        }
        for (let v = 0; v < p.count; v++) expect(p.getY(v)).toBeCloseTo(t.seaLevel, 6);
      }
      for (let cz = b.z0; cz < b.z1; cz++) for (let cx = b.x0; cx < b.x1; cx++) {
        if (terrainHeight(t, t.originX + cx, t.originZ + cz) >= t.seaLevel) continue;
        needed++;
        if (cells.has(`${cx},${cz}`)) covered++;
      }
    }
    expect(needed).toBeGreaterThan(100);
    expect(covered).toBe(needed);
  });
});
