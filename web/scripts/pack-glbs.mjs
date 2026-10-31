#!/usr/bin/env node
/**
 * Packs GLBs for the web without changing a byte the GPU gets: each geometry and animation buffer view
 * meshopt-compressed as it is (EXT_meshopt_compression: the vertex codec, or the index sequence codec, which keeps
 * every triangle's vertex order; no quantizing, no filters, no reordering), and each PNG image as lossless WebP
 * (EXT_texture_webp, cwebp -lossless -exact), each where that is smaller over the wire (brotli). Everything else in the file's JSON stays as written
 * (a rewrite through gltf-transform would drop near-identity node rotations and rotate triangles). Files already
 * meshopt-compressed are left alone. Run it again after re-exporting a model.
 *
 *   node web/scripts/pack-glbs.mjs <file.glb>...
 *
 * Packed: the GLBs the island loads before you can move (specs/perf/entry-trace.mjs's JSON lists them), but the
 * characters' (scripts/sync-character-assets.mjs copies those from art/characters as they are).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";
import { MeshoptEncoder } from "meshoptimizer";

await MeshoptEncoder.ready;
const tmp = mkdtempSync(join(tmpdir(), "pack-glbs-"));
const ELEMENT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const pad4 = n => (n + 3) & ~3;
/** What a file costs over the wire: the CDN serves GLBs brotli-compressed. */
const wire = b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length;

/** A PNG's lossless WebP, or null when it isn't smaller. */
function webp(png) {
  writeFileSync(join(tmp, "in.png"), png);
  execFileSync("cwebp", ["-quiet", "-lossless", "-exact", "-z", "9", "-metadata", "none", join(tmp, "in.png"), "-o", join(tmp, "out.webp")]);
  const out = readFileSync(join(tmp, "out.webp"));
  return out.length < png.length ? out : null;
}

/** One GLB's bytes packed, or null when it has nothing to pack (or is packed already). */
export function packGlbBytes(glb) {
  const jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  if (json.extensionsUsed?.includes("EXT_meshopt_compression") || json.buffers?.length !== 1 || json.buffers[0].uri !== undefined) return null;
  const binAt = 20 + jsonLength + 8, bin = glb.subarray(binAt, binAt + glb.readUInt32LE(20 + jsonLength));
  const views = json.bufferViews ?? [];
  // What each buffer view holds: an image, indices, or vertex and animation data (and the element sizes in it).
  const use = views.map(() => ({ sizes: new Set(), index: false, image: null, other: false }));
  for (const a of json.accessors ?? []) {
    if (a.bufferView !== undefined) use[a.bufferView].sizes.add(ELEMENT[a.type] * BYTES[a.componentType]);
    if (a.sparse) { use[a.sparse.indices.bufferView].other = true; use[a.sparse.values.bufferView].other = true; }
  }
  for (const m of json.meshes ?? []) for (const p of m.primitives) if (p.indices !== undefined && json.accessors[p.indices].bufferView !== undefined) use[json.accessors[p.indices].bufferView].index = true;
  for (const img of json.images ?? []) if (img.bufferView !== undefined) use[img.bufferView].image = img;

  const chunks = [], moved = [];
  let at = 0, packed = 0, images = 0;
  const put = data => { const o = at; chunks.push(data, Buffer.alloc(pad4(data.length) - data.length)); at += pad4(data.length); return o; };
  views.forEach((v, i) => {
    const data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength), u = use[i];
    if (u.image?.mimeType === "image/png") {
      const out = webp(data);
      if (out) { u.image.mimeType = "image/webp"; Object.assign(v, { byteOffset: put(out), byteLength: out.length }); images++; return; }
    }
    const stride = v.byteStride ?? (u.sizes.size === 1 ? [...u.sizes][0] : 0);
    const ok = !u.image && !u.other && stride > 0 && v.byteLength % stride === 0 && (u.index ? stride === 2 || stride === 4 : stride % 4 === 0 && stride <= 256);
    if (!ok) { v.byteOffset = put(data); return; }
    const count = v.byteLength / stride, mode = u.index ? "INDICES" : "ATTRIBUTES";
    const out = Buffer.from(MeshoptEncoder.encodeGltfBuffer(new Uint8Array(data), count, stride, mode));
    // Meshopt without quantizing doesn't always beat brotli on the raw floats: kept only where it is smaller on the wire.
    if (wire(out) + 128 >= wire(data)) { v.byteOffset = put(data); return; }
    v.extensions = { ...v.extensions, EXT_meshopt_compression: { buffer: 0, byteOffset: put(out), byteLength: out.length, byteStride: stride, count, mode } };
    moved.push(v);
    packed++;
  });
  if (!packed && !images) return null;
  // The compressed views' own ranges move to a fallback buffer that holds no bytes: the decoder fills them.
  if (packed) {
    let end = 0;
    for (const v of moved) { v.buffer = 1; v.byteOffset = end; end += pad4(v.byteLength); }
    json.buffers.push({ byteLength: end, extensions: { EXT_meshopt_compression: { fallback: true } } });
  }
  json.buffers[0].byteLength = at;
  for (const [name, on] of [["EXT_meshopt_compression", packed], ["EXT_texture_webp", images]]) {
    if (!on) continue;
    json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), name])];
    json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), name])];
  }
  // EXT_texture_webp: a texture whose image is now WebP names it through the extension (no PNG ships beside it).
  if (images) for (const t of json.textures ?? []) {
    if (t.source === undefined || json.images[t.source].mimeType !== "image/webp") continue;
    t.extensions = { ...t.extensions, EXT_texture_webp: { source: t.source } };
    delete t.source;
  }
  const text = Buffer.from(JSON.stringify(json)), jsonChunk = Buffer.concat([text, Buffer.alloc(pad4(text.length) - text.length, 0x20)]);
  const binChunk = Buffer.concat(chunks), header = Buffer.alloc(12);
  header.write("glTF", 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const head = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4); return b; };
  const bytes = Buffer.concat([header, head(jsonChunk.length, "JSON"), jsonChunk, head(binChunk.length, "BIN\0"), binChunk]);
  return wire(bytes) < wire(glb) ? { bytes, packed, images } : null;
}

/** Packs one GLB in place (also used by sync-character-assets.mjs). */
export function packGlb(file) {
  const before = readFileSync(file), out = packGlbBytes(before);
  if (!out) return console.log(`${file}: nothing to pack`);
  writeFileSync(file, out.bytes);
  console.log(`${file}: ${before.length} -> ${out.bytes.length} bytes, ${wire(before)} -> ${wire(out.bytes)} brotli (${out.packed} buffer views meshopt, ${out.images} PNG images to WebP)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) for (const f of process.argv.slice(2)) packGlb(f);
