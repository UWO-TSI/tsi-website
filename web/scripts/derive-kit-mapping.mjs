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
const WALL_MATERIAL = { cliff: /mCliff/i, river: /mRiver(?!Bed)/i, fall: /mWaterfall/i }[KIT] ?? /mCliff/i;

function readGLB(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString("utf8"));
  return { json, bin: b, binOffset: 20 + jsonLen + 8 };
}

/** Float positions of every primitive whose material matches `re`. */
function wallPoints(file, re) {
  const { json, bin, binOffset } = readGLB(file);
  const pts = [];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const matName = json.materials?.[prim.material]?.name ?? "";
      if (!re.test(matName) && !re.test(mesh.name ?? "")) continue;
      const acc = json.accessors[prim.attributes.POSITION];
      const bv = json.bufferViews[acc.bufferView];
      const stride = bv.byteStride || 12;
      const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
      for (let i = 0; i < acc.count; i++) {
        const o = base + i * stride;
        pts.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
      }
    }
  }
  return pts;
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
  return hits.map((h, d) => (d % 2 === 0 ? h >= 4 : h >= 3));
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
  const pts = wallPoints(path.join(KIT_DIR, f), WALL_MATERIAL);
  if (pts.length === 0) {
    rows.push({ stem, klass: +m[1], variant: m[2], rot: +m[3], mask: null, note: "no wall geometry" });
    continue;
  }
  const walled = walledDirs(pts);
  // Wall present => that neighbour is LOWER => the mask bit is CLEAR.
  let mask = 0;
  for (let d = 0; d < 8; d++) if (!walled[d]) mask |= 1 << d;
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
