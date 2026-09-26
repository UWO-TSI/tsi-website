#!/usr/bin/env node
// Inspect a character GLB: triangles, materials, bones, sockets, clips, bounds, flat normals.
// Usage: node web/scripts/character-inspect.mjs art/characters/base/base_body.glb [--json]
import { NodeIO } from '@gltf-transform/core';
import { statSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: character-inspect.mjs <file.glb> [--json]');
  process.exit(1);
}
const doc = await new NodeIO().read(file);
const root = doc.getRoot();

let tris = 0;
let verts = 0;
let flatTris = 0;
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
const primitives = [];
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const nrm = prim.getAttribute('NORMAL');
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : pos.getCount();
    const t = count / 3;
    tris += t;
    verts += pos.getCount();
    const c = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      const p = pos.getElement(i, []);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
        c[k] += p[k] / pos.getCount();
      }
    }
    // flat check: all three vertex normals equal the geometric face normal
    for (let f = 0; f < t; f++) {
      const ids = [0, 1, 2].map((k) => (idx ? idx.getScalar(f * 3 + k) : f * 3 + k));
      const [a, b, d] = ids.map((i) => pos.getElement(i, []));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1;
      const ok = nrm && ids.every((i) => {
        const vn = nrm.getElement(i, []);
        return (vn[0] * n[0] + vn[1] * n[1] + vn[2] * n[2]) / len > 0.999;
      });
      if (ok) flatTris++;
    }
    const mat = prim.getMaterial();
    primitives.push({
      mesh: mesh.getName(),
      material: mat?.getName() ?? null,
      tris: t,
      centroid: c.map((x) => +x.toFixed(3)),
      attributes: prim.listSemantics(),
    });
  }
}

const toHex = (f) =>
  '#' + f.slice(0, 3).map((x) => {
    const s = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
const materials = root.listMaterials().map((m) => {
  const tex = m.getBaseColorTexture();
  return {
    name: m.getName(),
    baseColor: toHex(m.getBaseColorFactor()),
    texture: tex ? `${tex.getName() || 'image'} ${tex.getSize()?.join('x')} ${tex.getMimeType()}` : null,
  };
});

const skins = root.listSkins().map((s) => ({ name: s.getName(), joints: s.listJoints().map((j) => j.getName()) }));
const jointSet = new Set(skins.flatMap((s) => s.joints));
const sockets = root.listNodes()
  .filter((n) => /^Socket_/.test(n.getName()))
  .map((n) => {
    const parent = root.listNodes().find((p) => p.listChildren().includes(n));
    return { name: n.getName(), parent: parent?.getName() ?? null };
  });

const clips = root.listAnimations().map((a) => {
  let dur = 0;
  let keys = 0;
  for (const s of a.listSamplers()) {
    const input = s.getInput();
    dur = Math.max(dur, input.getMax([])[0]);
    keys = Math.max(keys, input.getCount());
  }
  const targets = new Set(a.listChannels().map((c) => c.getTargetNode()?.getName()));
  return { name: a.getName(), duration: +dur.toFixed(3), keys, channels: a.listChannels().length, bones: targets.size };
});

const report = {
  file,
  bytes: statSync(file).size,
  triangles: tris,
  vertices: verts,
  flatNormalTris: `${flatTris}/${tris}`,
  bounds: { min: min.map((x) => +x.toFixed(3)), max: max.map((x) => +x.toFixed(3)), height: +(max[1] - min[1]).toFixed(3) },
  primitives,
  materials,
  bones: [...jointSet],
  boneCount: jointSet.size,
  sockets,
  clips,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`${file}  ${(report.bytes / 1024).toFixed(1)} KB`);
  console.log(`triangles ${tris}  vertices ${verts}  flat-normal tris ${report.flatNormalTris}`);
  console.log(`bounds min ${report.bounds.min}  max ${report.bounds.max}  height ${report.bounds.height} (Y up)`);
  console.log('primitives:');
  for (const p of primitives) console.log(`  ${p.material}  ${p.tris} tris  centroid ${p.centroid}`);
  console.log('materials:');
  for (const m of materials) console.log(`  ${m.name}  ${m.baseColor}${m.texture ? '  tex ' + m.texture : ''}`);
  console.log(`bones (${report.boneCount}): ${report.bones.join(', ')}`);
  console.log('sockets:');
  for (const s of sockets) console.log(`  ${s.name} -> ${s.parent}`);
  console.log('clips:');
  for (const c of clips) console.log(`  ${c.name}  ${c.duration}s  ${c.keys} keys  ${c.bones} bones`);
}
