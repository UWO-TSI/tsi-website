// Asset audit (specs/asset-audit/README.md): geometry, material and texture stats for GLBs, read offline.
//   cd web && node ../specs/asset-audit/tools/glb-stats.mjs <out.json> [dir-or-glb ...]   (default: public/assets)
// Per file: triangles (visible and shadow-caster), vertices, primitives, materials (roughness, metalness, maps),
// textures (pixel sizes), bounds, plus the defect probes the audit scores:
//   flat      share of triangles whose three vertex normals all match the face normal (faceted shading)
//   open      share of welded edges used by one triangle only (holes, cards, unfinished shells)
//   dupFaces  triangles with a coplanar twin at the same spot (z-fighting candidates)
//   inverted  triangles whose winding disagrees with their vertex normals (inside-out faces)
//   sig       per-primitive signature "vertexCount|indexCount|material" (matched against the live scene census)
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Resolved from web/ (run from there): the tools folder has no node_modules of its own.
const fromWeb = createRequire(join(process.cwd(), "package.json"));
const { NodeIO } = await import(pathToFileURL(fromWeb.resolve("@gltf-transform/core")).href);
const { ALL_EXTENSIONS } = await import(pathToFileURL(fromWeb.resolve("@gltf-transform/extensions")).href);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [out, ...roots] = process.argv.slice(2);
const files = [];
const walk = p => statSync(p).isDirectory() ? readdirSync(p).forEach(n => walk(join(p, n))) : p.endsWith(".glb") && files.push(p);
(roots.length ? roots : ["public/assets"]).forEach(walk);

const CASTER = /shadow/i;
const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
const xf = (m, v, w = 1) => [0, 1, 2].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * w);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Pixel size of an embedded PNG or JPEG. */
function imageSize(buf, mime) {
  if (!buf) return null;
  const b = Buffer.from(buf);
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") {
    const fmt = b.slice(12, 16).toString();
    if (fmt === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (fmt === "VP8L") { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
    if (fmt === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  return mime ? null : null;
}

const rows = [];
for (const f of files) {
  let doc;
  try { doc = await io.read(f); } catch (e) { rows.push({ file: f, error: String(e).slice(0, 160) }); continue; }
  const root = doc.getRoot();
  const r = {
    file: f.replace(/^public/, ""), bytes: statSync(f).size, tris: 0, casterTris: 0, verts: 0, prims: 0,
    materials: root.listMaterials().map(m => ({
      name: m.getName(), color: m.getBaseColorFactor().slice(0, 3).map(x => +x.toFixed(3)), alpha: +m.getBaseColorFactor()[3].toFixed(3),
      roughness: +m.getRoughnessFactor().toFixed(2), metalness: +m.getMetallicFactor().toFixed(2), map: !!m.getBaseColorTexture(),
      normalMap: !!m.getNormalTexture(), emissive: m.getEmissiveFactor().some(x => x > 0) || !!m.getEmissiveTexture(),
      alphaMode: m.getAlphaMode(), doubleSided: m.getDoubleSided(),
    })),
    textures: root.listTextures().map(t => { const s = imageSize(t.getImage(), t.getMimeType()); return { name: t.getName() || t.getURI() || "", mime: t.getMimeType(), w: s?.[0] ?? null, h: s?.[1] ?? null, bytes: t.getImage()?.byteLength ?? 0 }; }),
    vertexColors: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity],
    flat: 0, open: 0, dupFaces: 0, inverted: 0, nodeTransforms: false, skinned: root.listSkins().length > 0, animations: root.listAnimations().length,
    sig: [],
  };
  let flatTris = 0, smoothChecked = 0, edgeTotal = 0, edgeOpen = 0, invTris = 0, normTris = 0;
  const faceKeys = new Map();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const visit = (node, parent) => {
    const local = node.getMatrix();
    if (local.some((x, i) => Math.abs(x - ID[i]) > 1e-6)) r.nodeTransforms = true;
    const m = mul(parent, local);
    const mesh = node.getMesh();
    if (mesh) for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const mat = p.getMaterial(), mname = mat?.getName() ?? "";
      const pos = p.getAttribute("POSITION"), nrm = p.getAttribute("NORMAL"), idx = p.getIndices();
      if (!pos) continue;
      r.prims++;
      r.sig.push(`${pos.getCount()}|${idx ? idx.getCount() : 0}|${mname}`);
      if (p.getAttribute("COLOR_0")) r.vertexColors = true;
      const n = idx ? idx.getCount() : pos.getCount(), tris = Math.floor(n / 3);
      if (CASTER.test(mname)) { r.casterTris += tris; continue; }
      r.tris += tris; r.verts += pos.getCount();
      const P = [], N = [];
      for (let i = 0; i < pos.getCount(); i++) {
        const w = xf(m, pos.getElement(i, []));
        P.push(w);
        for (let k = 0; k < 3; k++) { r.min[k] = Math.min(r.min[k], w[k]); r.max[k] = Math.max(r.max[k], w[k]); }
        if (nrm) N.push(norm(xf(m, nrm.getElement(i, []), 0)));
      }
      // Weld by position for the edge probe (UV and normal splits are not holes).
      const key = v => v.map(x => Math.round(x * 2000)).join(",");
      const weld = P.map(key);
      const edges = new Map();
      for (let t = 0; t + 2 < n; t += 3) {
        const [a, b, c] = idx ? [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)] : [t, t + 1, t + 2];
        const g = cross(sub(P[b], P[a]), sub(P[c], P[a])), area = Math.hypot(...g);
        if (area < 1e-12) continue;
        const fn = g.map(x => x / area);
        if (nrm) {
          normTris++;
          const s = [0, 1, 2].map(k => N[a][k] + N[b][k] + N[c][k]);
          if (dot(fn, s) < 0) invTris++;
          smoothChecked++;
          if ([a, b, c].every(i => Math.abs(dot(N[i], fn)) > 0.996)) flatTris++;
        }
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const k = weld[u] < weld[v] ? weld[u] + "|" + weld[v] : weld[v] + "|" + weld[u];
          edges.set(k, (edges.get(k) ?? 0) + 1);
        }
        const cen = [0, 1, 2].map(k => (P[a][k] + P[b][k] + P[c][k]) / 3);
        const fk = cen.map(x => Math.round(x * 400)).join(",") + "/" + fn.map(x => Math.round(Math.abs(x) * 20)).join(",");
        faceKeys.set(fk, (faceKeys.get(fk) ?? 0) + 1);
      }
      for (const c of edges.values()) { edgeTotal++; if (c === 1) edgeOpen++; }
    }
    for (const c of node.listChildren()) visit(c, m);
  };
  for (const n of scene.listChildren()) visit(n, ID);
  for (const c of faceKeys.values()) if (c > 1) r.dupFaces += c;
  r.flat = smoothChecked ? +(flatTris / smoothChecked).toFixed(3) : null;
  r.open = edgeTotal ? +(edgeOpen / edgeTotal).toFixed(3) : 0;
  r.inverted = normTris ? +(invTris / normTris).toFixed(3) : 0;
  r.min = r.min.map(x => +x.toFixed(3)); r.max = r.max.map(x => +x.toFixed(3));
  r.maxTex = Math.max(0, ...r.textures.map(t => Math.max(t.w ?? 0, t.h ?? 0)));
  rows.push(r);
}
writeFileSync(out, JSON.stringify(rows));
console.log(`${rows.length} files, ${rows.filter(r => r.error).length} unreadable`);
