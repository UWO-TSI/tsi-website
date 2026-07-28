#!/usr/bin/env node
/**
 * extract-grass-pack — turn a downloaded grass pack into instanceable tufts.
 *
 *   node scripts/extract-grass-pack.mjs [--src <glb>] [--tufts 6] [--blades 6]
 *
 * WHAT THE SOURCE ACTUALLY IS. David supplied `low_poly_grass_pack.glb`
 * (Sketchfab, 259KB). It reads as three meshes, but that is only how the
 * exporter merged it by material: splitting on connected components finds
 * **703 separate blades, every one exactly 7 triangles**, laid out in a row
 * across a 288-unit strip. It is not a set of dense clumps — it is a bag of
 * blades, and 7 triangles is the same order as the 4-triangle procedural card
 * it replaces. That is the whole performance answer.
 *
 * WHAT THIS PRODUCES. A handful of TUFT variants, each a merged cluster of
 * neighbouring source blades, based at the origin and normalised to 1.0 unit
 * tall so `tuning.grass.tuftHeight` stays meaningful. Instancing a tuft rather
 * than a blade keeps the instance count down without changing the triangle
 * count, and bakes natural clumping into the geometry instead of asking the
 * scatter to fake it.
 *
 * The three source materials differ only by baseColorFactor, so they are baked
 * into COLOR_0 and collapsed to ONE material — which is what makes the whole
 * grass layer a single draw call.
 *
 * (COLOR_0 is exactly what turned the trees neon lime once. That was because
 * the source used it for wind-sway weights while the material also had a
 * colour. Here it IS the colour and baseColorFactor is white, which is the
 * correct use of it.)
 */

import fs from "fs";
import path from "path";
import url from "url";
import os from "os";
import { NodeIO, Document } from "@gltf-transform/core";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};

const SRC = arg("src", path.join(os.homedir(), "Downloads/low_poly_grass_pack.glb"));
const TUFT_COUNT = Number(arg("tufts", 6));
const BLADES_PER_TUFT = Number(arg("blades", 6));
const OUT = path.join(WEB, "public/assets/nature/grass-tufts.glb");

const io = new NodeIO();
const src = await io.read(SRC);

/**
 * Sketchfab exports carry a -90deg X rotation on the root to convert Z-up to
 * Y-up. Bake it here so nothing downstream has to know or care.
 */
const bakeRoot = (x, y, z) => [x, z, -y];

// ── Split every primitive into connected components ──────────────
const blades = [];
for (const mesh of src.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const posA = prim.getAttribute("POSITION");
    const nrmA = prim.getAttribute("NORMAL");
    const idxA = prim.getIndices();
    const n = posA.getCount();

    const P = new Float32Array(n * 3);
    const N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = bakeRoot(...posA.getElement(i, []));
      P[i * 3] = v[0];
      P[i * 3 + 1] = v[1];
      P[i * 3 + 2] = v[2];
      if (nrmA) {
        const m = bakeRoot(...nrmA.getElement(i, []));
        N[i * 3] = m[0];
        N[i * 3 + 1] = m[1];
        N[i * 3 + 2] = m[2];
      } else {
        N[i * 3 + 1] = 1;
      }
    }
    const I = idxA ? Array.from(idxA.getArray()) : Array.from({ length: n }, (_, i) => i);

    // Weld on quantised position first, so a component is not split by the
    // duplicated vertices an exporter leaves at material or UV seams.
    const slot = new Map();
    const weld = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(P[i * 3] * 100)},${Math.round(P[i * 3 + 1] * 100)},${Math.round(P[i * 3 + 2] * 100)}`;
      if (!slot.has(k)) slot.set(k, slot.size);
      weld[i] = slot.get(k);
    }
    const parent = Int32Array.from({ length: slot.size }, (_, i) => i);
    const find = (a) => {
      while (parent[a] !== a) a = parent[a] = parent[parent[a]];
      return a;
    };
    const union = (a, b) => {
      a = find(a);
      b = find(b);
      if (a !== b) parent[b] = a;
    };
    for (let t = 0; t < I.length; t += 3) {
      union(weld[I[t]], weld[I[t + 1]]);
      union(weld[I[t]], weld[I[t + 2]]);
    }

    const colour = prim.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1];
    const groups = new Map();
    for (let t = 0; t < I.length; t += 3) {
      const root = find(weld[I[t]]);
      let g = groups.get(root);
      if (!g) {
        g = { tri: [], colour };
        groups.set(root, g);
      }
      g.tri.push(I[t], I[t + 1], I[t + 2]);
    }

    for (const g of groups.values()) {
      // Re-index into a standalone blade with its own vertex list.
      const remap = new Map();
      const pos = [];
      const nrm = [];
      const idx = [];
      for (const vi of g.tri) {
        let to = remap.get(vi);
        if (to === undefined) {
          to = pos.length / 3;
          remap.set(vi, to);
          pos.push(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]);
          nrm.push(N[vi * 3], N[vi * 3 + 1], N[vi * 3 + 2]);
        }
        idx.push(to);
      }
      let minY = Infinity;
      let maxY = -Infinity;
      let cx = 0;
      let cz = 0;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        minY = Math.min(minY, pos[i * 3 + 1]);
        maxY = Math.max(maxY, pos[i * 3 + 1]);
        cx += pos[i * 3];
        cz += pos[i * 3 + 2];
      }
      blades.push({
        pos,
        nrm,
        idx,
        colour: g.colour,
        height: maxY - minY,
        baseY: minY,
        cx: cx / count,
        cz: cz / count,
      });
    }
  }
}

blades.sort((a, b) => a.cx - b.cx || a.cz - b.cz);
console.log(`source: ${blades.length} blades, ${blades.reduce((s, b) => s + b.idx.length / 3, 0)} triangles`);
console.log(
  `        ${(blades.reduce((s, b) => s + b.idx.length / 3, 0) / blades.length).toFixed(1)} tri/blade avg · heights ${Math.min(
    ...blades.map((b) => b.height)
  ).toFixed(1)} .. ${Math.max(...blades.map((b) => b.height)).toFixed(1)}`
);

// Drop the runts: a blade under a fifth of the median height is a stray shard,
// and instancing it wastes a draw's worth of nothing.
const median = blades.map((b) => b.height).sort((a, b) => a - b)[Math.floor(blades.length / 2)];
const usable = blades.filter((b) => b.height > median * 0.2);
console.log(`        ${usable.length} usable after dropping shards under ${(median * 0.2).toFixed(2)} tall`);

// ── Build tufts from neighbouring blades ─────────────────────────
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("grass-tufts");
const material = doc
  .createMaterial("grass")
  .setBaseColorFactor([1, 1, 1, 1])
  .setRoughnessFactor(0.95)
  .setMetallicFactor(0)
  .setDoubleSided(true);

const stride = Math.max(1, Math.floor(usable.length / TUFT_COUNT));
let report = [];

for (let t = 0; t < TUFT_COUNT; t++) {
  const start = t * stride;
  const group = usable.slice(start, start + BLADES_PER_TUFT);
  if (group.length === 0) continue;

  // Base the cluster on its own footprint centre and its own ground plane.
  let cx = 0;
  let cz = 0;
  let baseY = Infinity;
  let top = -Infinity;
  for (const b of group) {
    cx += b.cx;
    cz += b.cz;
    baseY = Math.min(baseY, b.baseY);
    top = Math.max(top, b.baseY + b.height);
  }
  cx /= group.length;
  cz /= group.length;
  // Normalise so the tallest blade is exactly 1.0 — `tuftHeight` then reads as
  // world units and means the same thing for every variant.
  const k = 1 / Math.max(1e-6, top - baseY);

  const pos = [];
  const nrm = [];
  const col = [];
  const idx = [];
  for (const b of group) {
    const off = pos.length / 3;
    for (let i = 0; i < b.pos.length / 3; i++) {
      pos.push((b.pos[i * 3] - cx) * k, (b.pos[i * 3 + 1] - baseY) * k, (b.pos[i * 3 + 2] - cz) * k);
      nrm.push(b.nrm[i * 3], b.nrm[i * 3 + 1], b.nrm[i * 3 + 2]);
      col.push(b.colour[0], b.colour[1], b.colour[2], 1);
    }
    for (const i of b.idx) idx.push(i + off);
  }

  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buffer))
    .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(new Float32Array(col)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(idx)).setBuffer(buffer));

  const mesh = doc.createMesh(`tuft-${t}`).addPrimitive(prim);
  scene.addChild(doc.createNode(`tuft-${t}`).setMesh(mesh));
  report.push({ name: `tuft-${t}`, blades: group.length, tris: idx.length / 3 });
}

doc.getRoot().setDefaultScene(scene);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);

console.log(`\ntufts written to ${path.relative(WEB, OUT)}:`);
for (const r of report) console.log(`  ${r.name.padEnd(9)} ${String(r.blades).padStart(2)} blades  ${String(r.tris).padStart(3)} tri`);
const avg = report.reduce((s, r) => s + r.tris, 0) / report.length;
console.log(`\naverage ${avg.toFixed(1)} tri/tuft · file ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB · 1 material`);
console.log(`budget: at N tufts the layer costs N x ${avg.toFixed(0)} triangles in ONE draw call.`);
