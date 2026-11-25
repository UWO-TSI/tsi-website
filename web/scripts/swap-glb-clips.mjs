#!/usr/bin/env node
/**
 * Swaps clips into a GLB in place: every animation in <clips.glb> replaces the one of the same name in <base.glb>
 * (or is added), its channels re-targeted to base's nodes by name. Raw JSON and BIN: the meshes, skins, images and every
 * other byte the GPU gets stay exactly as they were (a gltf-transform rewrite would drop near-identity rotations and the
 * hidden-cut attributes' layout, pack-glbs.mjs). Accessors and buffer views nothing uses any more are dropped.
 *
 *   node web/scripts/swap-glb-clips.mjs <base.glb> <clips.glb>
 *
 * build_clips.py `-- head v8 loco` (vb-anim round 2) bakes the walk, the run and the dash and swaps them into
 * art/characters/base/v8_clips.glb this way; then hidden_cut.py bodycut and sync-character-assets.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";

const pad4 = n => (n + 3) & ~3;
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }, BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

function parse(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const at = 20 + jsonLen;
  return { json, bin: at < buf.length ? buf.subarray(at + 8, at + 8 + buf.readUInt32LE(at)) : Buffer.alloc(0) };
}

function glb(json, bin) {
  const j = Buffer.from(JSON.stringify(json)), jp = Buffer.alloc(pad4(j.length), 0x20), bp = Buffer.alloc(pad4(bin.length));
  j.copy(jp); bin.copy(bp);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  jh.writeUInt32LE(jp.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bp.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jp, bh, bp]);
}

export function swapClips(baseBuf, clipsBuf) {
  const base = parse(baseBuf), src = parse(clipsBuf), B = base.json, S = src.json;
  const nodeOf = new Map(B.nodes.map((n, i) => [n.name, i]));
  const chunks = [base.bin], copied = new Map();
  let end = base.bin.length;
  const copy = i => {                                           // a clip's accessor, its bytes appended to base's BIN
    if (copied.has(i)) return copied.get(i);
    const a = S.accessors[i], v = S.bufferViews[a.bufferView], n = a.count * SIZE[a.type] * BYTES[a.componentType];
    const at = pad4(end);
    chunks.push(Buffer.alloc(at - end), src.bin.subarray((v.byteOffset ?? 0) + (a.byteOffset ?? 0), (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + n));
    end = at + n;
    B.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: n });
    B.accessors.push({ ...a, bufferView: B.bufferViews.length - 1, byteOffset: undefined });
    copied.set(i, B.accessors.length - 1);
    return B.accessors.length - 1;
  };
  B.animations ??= [];
  for (const anim of S.animations ?? []) {
    const out = {
      name: anim.name,
      samplers: anim.samplers.map(s => ({ ...s, input: copy(s.input), output: copy(s.output) })),
      channels: anim.channels.map(c => {
        const node = nodeOf.get(S.nodes[c.target.node].name);
        if (node === undefined) throw new Error(`${anim.name}: no node ${S.nodes[c.target.node].name} in the base`);
        return { ...c, target: { ...c.target, node } };
      }),
    };
    const k = B.animations.findIndex(a => a.name === anim.name);
    if (k >= 0) B.animations[k] = out; else B.animations.push(out);
  }
  // Drop what nothing uses now, keeping every other buffer view's bytes and order.
  const usedAcc = new Set();
  for (const m of B.meshes ?? []) for (const p of m.primitives) {
    Object.values(p.attributes).forEach(i => usedAcc.add(i));
    if (p.indices !== undefined) usedAcc.add(p.indices);
    for (const t of p.targets ?? []) Object.values(t).forEach(i => usedAcc.add(i));
  }
  for (const s of B.skins ?? []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
  for (const a of B.animations) for (const s of a.samplers) { usedAcc.add(s.input); usedAcc.add(s.output); }
  const accMap = new Map(), accs = [];
  B.accessors.forEach((a, i) => { if (usedAcc.has(i)) { accMap.set(i, accs.length); accs.push(a); } });
  const usedView = new Set([...accs.map(a => a.bufferView), ...(B.images ?? []).map(im => im.bufferView)].filter(v => v !== undefined));
  const bin = Buffer.concat([...chunks, Buffer.alloc(pad4(end) - end)]), views = [], viewMap = new Map(), parts = [];
  let at = 0;
  B.bufferViews.forEach((v, i) => {
    if (!usedView.has(i)) return;
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength), o = pad4(at);
    parts.push(Buffer.alloc(o - at), bytes);
    at = o + v.byteLength;
    viewMap.set(i, views.length);
    views.push({ ...v, byteOffset: o });
  });
  for (const a of accs) a.bufferView = viewMap.get(a.bufferView);
  for (const im of B.images ?? []) if (im.bufferView !== undefined) im.bufferView = viewMap.get(im.bufferView);
  const re = i => accMap.get(i);
  for (const m of B.meshes ?? []) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = re(p.attributes[k]);
    if (p.indices !== undefined) p.indices = re(p.indices);
    for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = re(t[k]);
  }
  for (const s of B.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = re(s.inverseBindMatrices);
  for (const a of B.animations) for (const s of a.samplers) { s.input = re(s.input); s.output = re(s.output); }
  B.accessors = accs; B.bufferViews = views;
  const out = Buffer.concat(parts);
  B.buffers[0].byteLength = out.length;
  return glb(B, out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [basePath, clipsPath] = process.argv.slice(2);
  if (!basePath || !clipsPath) { console.error("usage: swap-glb-clips.mjs <base.glb> <clips.glb>"); process.exit(1); }
  const out = swapClips(readFileSync(basePath), readFileSync(clipsPath));
  writeFileSync(basePath, out);
  console.log(`swapped ${parse(readFileSync(clipsPath)).json.animations.map(a => a.name).join(", ")} into ${basePath} (${out.length} bytes)`);
}
