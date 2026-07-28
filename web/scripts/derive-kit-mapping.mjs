#!/usr/bin/env node
/**
 * derive-kit-mapping — work out which cliff piece answers which neighbourhood,
 * by measuring the meshes rather than eyeballing them.
 *
 *   node scripts/derive-kit-mapping.mjs [--kit cliff]
 *
 * M2 left CONFIG_TO_PIECE empty on purpose: the autotile solver is settled
 * math, but which FILE each configuration wants is Nintendo's convention and
 * is not readable off a filename. The plan was to lock it by eye in M6.
 *
 * There is a better way. A cliff piece carries rock wall EXACTLY where its
 * neighbour is lower — that is what a cliff is. So the position of the
 * `mCliff` geometry inside the 10x10 tile footprint encodes the neighbour
 * mask directly, and we can read it off instead of guessing:
 *
 *     wall on the north edge  ->  north neighbour is lower  ->  mask bit clear
 *     no wall on the north edge -> north neighbour is level ->  mask bit set
 *
 * Diagonals work the same way with the corner quadrants. Output is a mapping
 * from our canonical config id to a `{class}-{variant}` stem, which drops
 * straight into CONFIG_TO_PIECE.
 */

import fs from "fs";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const grid = await import(path.join(WEB, "lib/game/grid.ts"));

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i === -1 ? d : process.argv[i + 1];
};
const KIT = arg("--kit", "cliff");
const KIT_DIR = path.join(WEB, "public/assets/acnh", KIT);

// The material that IS the vertical face, per kit.
// For the river this is the BANK, not the water. Measured: `mRiver` is a
// full-tile quad on almost every piece, so probing it reports "wet on all
// sides" for two thirds of the kit. What actually encodes the neighbourhood is
// where the piece puts GROUND — same as a cliff putting rock where the drop is.
const WALL_MATERIAL = {
  cliff: /mCliff/i,
  river: /mGrass(?!River)/i,
  fall: /mWaterfall/i,
}[KIT] ?? /mCliff/i;

/**
 * Does finding the material at an edge mean the mask bit is SET or CLEAR?
 *
 * The two kits are opposites and it is not a detail:
 *
 *   CLIFF  `mCliff` is a WALL. A wall on the north edge means the north
 *          neighbour is LOWER, i.e. not part of this tier — bit CLEAR.
 *   RIVER  probed on `mGrass`, the BANK. Ground on the north edge means the
 *          north neighbour is land, not river — bit CLEAR, same as a cliff.
 *
 * Run with the wrong polarity and the table is a mirror of itself: the 4-way
 * junction `0-a-0` comes back as an isolated pond and the fully-enclosed
 * `4-c-0` as a lone stub. Both are legal-looking configs, so nothing errors —
 * the river just renders inside out.
 */
const EDGE_MEANS_SAME = { cliff: false, river: false, fall: true }[KIT] ?? false;

/** Surface kits need their polygons sampled, not just their vertices. */
const DENSIFY = KIT !== "cliff";

function readGLB(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString("utf8"));
  return { json, bin: b, binOffset: 20 + jsonLen + 8 };
}

/**
 * Read an accessor of scalar indices.
 */
function readIndices(json, bin, binOffset, accIdx) {
  const acc = json.accessors[accIdx];
  const bv = json.bufferViews[acc.bufferView];
  const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = new Array(acc.count);
  for (let i = 0; i < acc.count; i++) {
    out[i] =
      acc.componentType === 5125
        ? bin.readUInt32LE(base + i * 4)
        : acc.componentType === 5123
          ? bin.readUInt16LE(base + i * 2)
          : bin.readUInt8(base + i);
  }
  return out;
}

/** Float positions of every primitive whose material matches `re`. */
function wallPoints(file, re) {
  const { json, bin, binOffset } = readGLB(file);
  const pts = [];
  const tris = [];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const matName = json.materials?.[prim.material]?.name ?? "";
      if (!re.test(matName) && !re.test(mesh.name ?? "")) continue;
      const acc = json.accessors[prim.attributes.POSITION];
      const bv = json.bufferViews[acc.bufferView];
      const stride = bv.byteStride || 12;
      const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const verts = [];
      for (let i = 0; i < acc.count; i++) {
        const o = base + i * stride;
        verts.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
      }
      pts.push(...verts);

      if (DENSIFY && prim.indices !== undefined) {
        const idx = readIndices(json, bin, binOffset, prim.indices);
        for (let t = 0; t < idx.length; t += 3) {
          const a = verts[idx[t]];
          const b = verts[idx[t + 1]];
          const c = verts[idx[t + 2]];
          if (a && b && c) tris.push([a, b, c]);
        }
      }
    }
  }
  return { pts, tris };
}

/**
 * Rasterise triangles into a fixed grid over the 10x10 tile.
 *
 * WHY NOT JUST SAMPLE THE TRIANGLES. Barycentric sampling puts a fixed number
 * of points on every triangle regardless of its size, so a big water quad ends
 * up sparser per unit area than a small bank sliver — and any count threshold
 * is then measuring tessellation, not coverage. `0-a-0` is a four-way junction
 * and it came back reporting water on two sides.
 *
 * An occupancy grid is density-independent: a cell is wet or it is not, and the
 * answer is the same whether the polygon over it is one triangle or fifty.
 */
const RES = 48;
const HALF = 5; // tile is 10x10 raw, centred

function occupancy(tris) {
  const g = new Uint8Array(RES * RES);
  const toCell = (v) => Math.floor(((v + HALF) / (HALF * 2)) * RES);
  for (const [a, b, c] of tris) {
    const xs = [a[0], b[0], c[0]];
    const zs = [a[2], b[2], c[2]];
    const x0 = Math.max(0, toCell(Math.min(...xs)));
    const x1 = Math.min(RES - 1, toCell(Math.max(...xs)));
    const z0 = Math.max(0, toCell(Math.min(...zs)));
    const z1 = Math.min(RES - 1, toCell(Math.max(...zs)));
    // Edge functions, evaluated at each candidate cell centre.
    const d = (px, pz, p, q) => (px - p[0]) * (q[2] - p[2]) - (pz - p[2]) * (q[0] - p[0]);
    for (let zi = z0; zi <= z1; zi++) {
      for (let xi = x0; xi <= x1; xi++) {
        const px = ((xi + 0.5) / RES) * HALF * 2 - HALF;
        const pz = ((zi + 0.5) / RES) * HALF * 2 - HALF;
        const s1 = d(px, pz, a, b);
        const s2 = d(px, pz, b, c);
        const s3 = d(px, pz, c, a);
        const neg = s1 < 0 || s2 < 0 || s3 < 0;
        const pos = s1 > 0 || s2 > 0 || s3 > 0;
        if (!(neg && pos)) g[zi * RES + xi] = 1;
      }
    }
  }
  return g;
}

/** Fraction of a rectangular band of the tile that is occupied. */
function bandFill(g, xMin, xMax, zMin, zMax) {
  const toCell = (v) => Math.max(0, Math.min(RES - 1, Math.floor(((v + HALF) / (HALF * 2)) * RES)));
  let on = 0;
  let total = 0;
  for (let zi = toCell(zMin); zi <= toCell(zMax); zi++) {
    for (let xi = toCell(xMin); xi <= toCell(xMax); xi++) {
      total++;
      if (g[zi * RES + xi]) on++;
    }
  }
  return total ? on / total : 0;
}

/** Direction test on the occupancy grid: is this edge or corner wet? */
function occupiedDirs(g) {
  const MID = 2.0;
  const OUT = 4.0;
  const C = 3.4;
  const f = [];
  f[grid.Dir.N] = bandFill(g, -MID, MID, -HALF, -OUT);
  f[grid.Dir.S] = bandFill(g, -MID, MID, OUT, HALF);
  f[grid.Dir.E] = bandFill(g, OUT, HALF, -MID, MID);
  f[grid.Dir.W] = bandFill(g, -HALF, -OUT, -MID, MID);
  f[grid.Dir.NE] = bandFill(g, C, HALF, -HALF, -C);
  f[grid.Dir.SE] = bandFill(g, C, HALF, C, HALF);
  f[grid.Dir.SW] = bandFill(g, -HALF, -C, C, HALF);
  f[grid.Dir.NW] = bandFill(g, -HALF, -C, -HALF, -C);
  return f.map((v) => v >= 0.5);
}

/**
 * Which of the 8 directions carry wall. North is -Z and east is +X, matching
 * grid.ts. A direction counts as walled when enough wall vertices sit in its
 * band of the tile.
 */
function walledDirs(pts) {
  // Non-overlapping probes. A first pass used broad half-plane bands, but a
  // north wall runs the full width of the tile, so its two ends landed in the
  // NE/NW bands and swamped them — rounded corner pieces came back reporting
  // walls on diagonals only. Sample the MIDDLE of each edge, and the extreme
  // corner for each diagonal, with a gap between the two.
  const MID = 2.2; // half-width of an edge probe, centred on the edge
  const FACE = 4.0; // how far out the edge probe sits
  const CORNER = 3.6; // corner probes live beyond this on both axes

  const hits = new Array(8).fill(0);
  for (const [x, , z] of pts) {
    if (Math.abs(x) <= MID && z <= -FACE) hits[grid.Dir.N]++;
    if (Math.abs(x) <= MID && z >= FACE) hits[grid.Dir.S]++;
    if (Math.abs(z) <= MID && x >= FACE) hits[grid.Dir.E]++;
    if (Math.abs(z) <= MID && x <= -FACE) hits[grid.Dir.W]++;
    if (x >= CORNER && z <= -CORNER) hits[grid.Dir.NE]++;
    if (x >= CORNER && z >= CORNER) hits[grid.Dir.SE]++;
    if (x <= -CORNER && z >= CORNER) hits[grid.Dir.SW]++;
    if (x <= -CORNER && z <= -CORNER) hits[grid.Dir.NW]++;
  }
  // A face carries far more vertices than a corner fillet, so the two need
  // different bars; a flat count either misses corners or invents faces.
  const bar = DENSIFY ? [40, 24] : [4, 3];
  return hits.map((h, d) => (d % 2 === 0 ? h >= bar[0] : h >= bar[1]));
}

const files = fs
  .readdirSync(KIT_DIR)
  .filter((f) => f.endsWith(".glb"))
  .sort();

const rows = [];
for (const f of files) {
  const stem = f.replace(/\.glb$/, "");
  const m = /^(\d+)-([a-c])-(\d+)$/.exec(stem);
  if (!m) continue;
  const { pts, tris } = wallPoints(path.join(KIT_DIR, f), WALL_MATERIAL);
  if (pts.length === 0) {
    rows.push({ stem, klass: +m[1], variant: m[2], rot: +m[3], mask: null, note: "no wall geometry" });
    continue;
  }
  const walled = DENSIFY ? occupiedDirs(occupancy(tris)) : walledDirs(pts);
  let mask = 0;
  for (let d = 0; d < 8; d++) if (walled[d] === EDGE_MEANS_SAME) mask |= 1 << d;
  const choice = grid.autotile(mask);
  rows.push({
    stem,
    klass: +m[1],
    variant: m[2],
    rot: +m[3],
    mask,
    walled: walled.map((b, d) => (b ? "NnEeSsWw"[d] : ".")).join(""),
    config: choice.config,
    rotation: choice.rotation,
    verts: pts.length,
  });
}

console.log(`${KIT}: ${rows.length} pieces, wall material ${WALL_MATERIAL}\n`);
console.log("piece      walled(N NE E SE S SW W NW)  mask  ->  config  rot");
for (const r of rows) {
  if (r.mask === null) {
    console.log(`  ${r.stem.padEnd(9)} ${r.note}`);
    continue;
  }
  console.log(
    `  ${r.stem.padEnd(9)} ${r.walled.padEnd(28)} ${String(r.mask).padStart(4)}  ->  ${String(r.config).padStart(6)}  ${r.rotation}`
  );
}

// Coverage: how many of the 15 canonical configs did the kit actually answer?
const byConfig = new Map();
for (const r of rows) {
  if (r.mask === null) continue;
  const list = byConfig.get(r.config) ?? [];
  list.push(r);
  byConfig.set(r.config, list);
}
const configs = grid.listConfigs();
console.log(`\ncoverage: ${byConfig.size} of ${configs.length} canonical configs answered`);
const missing = configs.map((_, i) => i).filter((i) => !byConfig.has(i));
if (missing.length) console.log(`  unanswered configs: ${missing.join(", ")}`);
for (const [cfg, list] of [...byConfig].sort((a, b) => a[0] - b[0])) {
  const stems = [...new Set(list.map((r) => `${r.klass}-${r.variant}`))];
  console.log(`  config ${String(cfg).padStart(2)}  <-  ${stems.join(", ")}  (${list.length} pieces)`);
}

// ── Emit a paste-ready table ─────────────────────────────────────
// `_0.._3` turned out to be VISUAL VARIANTS, not rotations: all four files in
// a family share the same wall centroid and extents, and a 90-degree rotation
// would move the centroid. ACNH varies the rock detail so a long cliff run
// does not look tiled; the engine rotates. So a config maps to a stem plus a
// variant count, and the renderer picks a variant and applies the rotation.
const table = {};
for (const [cfg, list] of [...byConfig].sort((a, b) => a[0] - b[0])) {
  const stems = [...new Set(list.map((r) => `${r.klass}-${r.variant}`))];
  const chosen = stems[0];
  table[cfg] = { stem: chosen, variants: list.filter((r) => `${r.klass}-${r.variant}` === chosen).length };
}
console.log("\n// paste into CONFIG_TO_PIECE." + KIT);
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v])),
    null,
    2
  )
);
