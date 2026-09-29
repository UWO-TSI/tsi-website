#!/usr/bin/env node
/**
 * snap-world-to-grid — first-draft island map from the world as it stands
 * (M3, 2026-07-26).
 *
 *   node scripts/snap-world-to-grid.mjs [--out data/island-map.json]
 *
 * This is a ONE-OFF MIGRATION, not a build step. It reads the live world
 * (terrain heights, the road corridors, the coast function, the prop arrays)
 * and emits a cell map that M4 renders and M7 hand-authors on top of. Run it
 * once; after that `data/island-map.json` is the source of truth and this
 * script is history.
 *
 * WHAT TO EXPECT: level 0 almost everywhere. The current world's entire
 * elevation range is about 1.4u and one ACNH step is 1.5u, so there is
 * genuinely nothing here to terrace — the only thing that clears a step is
 * Temple Rise at 2.3u. That is the finding, not a bug in this script. The
 * terracing in David's reference screenshots is authored in M7; no snap of a
 * smooth heightfield can invent it.
 *
 * It reads the real constants rather than copying them:
 *   · terrain.ts imports directly (node strips the types)
 *   · the .tsx sources are PARSED for their literal arrays, because they
 *     import React and cannot be imported from a plain script
 * Parsing beats duplicating: there is no second copy to drift.
 */

import fs from "fs";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");

const terrain = await import(path.join(WEB, "components/game/terrain.ts"));
const coast = await import(path.join(WEB, "lib/game/coast.ts"));
const grid = await import(path.join(WEB, "lib/game/grid.ts"));

const { Surface, LEVEL_STEP, MAX_LEVEL, TILE } = grid;

// ── Map extent ───────────────────────────────────────────────────
// The island is radius 61, so 123 cells would cover it. 128 is the next clean
// multiple of CHUNK (16), giving exactly 8x8 chunks with no partial edge —
// worth the 5 cells of margin. David's ruling was to keep the current extent;
// note this is ~2.9x the area of a real ACNH island (80x64).
const SIZE = 128;

// Where the ground stops. coast.ts documents the legacy thresholds in its
// own space: sand starts at 48.5, the plane sinks at 49.5, and the waterline
// sits at about 51.4. Past the waterline there is no walkable ground, so those
// cells become Void.
const COAST_EDGE = 51.4;

// ── Source parsing ───────────────────────────────────────────────

function readSource(rel) {
  return fs.readFileSync(path.join(WEB, rel), "utf8");
}

/** Body text of `const NAME ... = [ ... ]`, bracket-matched. */
function arrayBody(src, name) {
  const m = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\[`).exec(src);
  if (!m) return null;
  let i = m.index + m[0].length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

/** Every `[a, b]` numeric pair in a named array. */
function parsePairs(src, name) {
  const body = arrayBody(src, name);
  if (!body) return [];
  return [...body.matchAll(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

/** Every `[a, b, c]` numeric triple in a named array (x, y, z). */
function parseTriples(src, name) {
  const body = arrayBody(src, name);
  if (!body) return [];
  return [...body.matchAll(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
  ]);
}

const gameWorldSrc = readSource("components/game/GameWorld.tsx");
const roadSrc = readSource("components/game/RoadTiles.tsx");

// Road corridor rectangles, with their surface zone. RoadTiles assigns zones
// by rectangle index at runtime; we re-derive from the same coordinates.
const roadRects = (() => {
  const body = arrayBody(roadSrc, "RECTS");
  if (!body) return [];
  return [...body.matchAll(/\{\s*x0:\s*(-?[\d.]+),\s*x1:\s*(-?[\d.]+),\s*z0:\s*(-?[\d.]+),\s*z1:\s*(-?[\d.]+)\s*\}/g)].map(
    (m) => ({ x0: +m[1], x1: +m[2], z0: +m[3], z1: +m[4] })
  );
})();

const buildings = (() => {
  const body = arrayBody(gameWorldSrc, "BUILDINGS");
  if (!body) return [];
  return [...body.matchAll(/id:\s*"([^"]+)"[\s\S]{0,220}?position:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g)].map(
    (m) => ({ id: m[1], x: +m[2], z: +m[4] })
  );
})();

const propGroups = [
  { kind: "tree", points: parsePairs(gameWorldSrc, "TREE_XZ") },
  { kind: "bush", points: parsePairs(gameWorldSrc, "BUSH_XZ") },
  { kind: "flower", points: parsePairs(gameWorldSrc, "FLOWER_XZ") },
  { kind: "lamp", points: parsePairs(gameWorldSrc, "LAMP_XZ") },
  { kind: "npc", points: parseTriples(gameWorldSrc, "FILLER_POSITIONS").map(([x, , z]) => [x, z]) },
];

// ── Snap ─────────────────────────────────────────────────────────

const map = grid.createCenteredMap(SIZE, SIZE);

/**
 * Surface for a cell centre. Order matters: the most specific claim wins,
 * mirroring how the runtime layers these today (river carve beats roads,
 * roads beat the beach bands, beach beats grass).
 */
function surfaceFor(x, z, height) {
  // Beyond the coastline there is no ground. The island silhouette is the
  // same organic coast function the ocean and ground shaders use, so the
  // tiled edge lands exactly where the painted one does today. Roughly half
  // of a square map is sea, and those cells emit nothing.
  const d = coast.coastDist(x, z);
  if (d > COAST_EDGE) return Surface.Void;

  // The river carve bottoms out at RIVER_DEPTH (-0.95). Nothing else in the
  // world goes below zero, so a clearly negative height IS the channel. This
  // avoids exporting riverInfluence just for the migration.
  if (height < -0.3) return Surface.River;

  for (const r of roadRects) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      // Wood deck pad and wharf apron are the two wood zones in RoadTiles;
      // the beach spur is sand; the plaza around the main crossing is stone.
      if (r.z0 >= 46 || (r.x0 >= 41 && r.z1 <= 0.5)) return Surface.Wood;
      if (r.x0 >= 1 && r.z0 >= 22) return Surface.Sand;
      if (Math.abs(r.x0) <= 2 && Math.abs(r.z0) <= 24) return Surface.Stone;
      return Surface.Soil;
    }
  }

  // Beach band, from the same coast function the ground shader uses. The
  // 48.5 threshold is the grass->sand blend point in GameWorld's Terrain().
  if (d > 48.5) return Surface.Sand;

  return Surface.Grass;
}

let maxHeight = -Infinity;
let minHeight = Infinity;
const levelHistogram = new Map();
const surfaceHistogram = new Map();

for (let cz = 0; cz < SIZE; cz++) {
  for (let cx = 0; cx < SIZE; cx++) {
    const x = grid.cellToWorldX(map, cx);
    const z = grid.cellToWorldZ(map, cz);
    const h = terrain.getTerrainHeight(x, z);
    maxHeight = Math.max(maxHeight, h);
    minHeight = Math.min(minHeight, h);

    const level = Math.max(0, Math.min(MAX_LEVEL, Math.round(h / LEVEL_STEP)));
    const surface = surfaceFor(x, z, h);
    grid.setCell(map, cx, cz, level, surface);

    levelHistogram.set(level, (levelHistogram.get(level) ?? 0) + 1);
    surfaceHistogram.set(surface, (surfaceHistogram.get(surface) ?? 0) + 1);
  }
}

// ── Props ────────────────────────────────────────────────────────
// Every prop snaps to the nearest cell centre. Anything that moves more than
// half a tile is reported: those are the placements the grid disagrees with,
// and they are the hand-pass shortlist for M7.

const SNAP_WARN = TILE * 0.5;
const props = [];
const movedFar = [];

function snapProp(kind, x, z, id) {
  const cx = grid.worldToCellX(map, x);
  const cz = grid.worldToCellZ(map, z);
  const sx = grid.cellToWorldX(map, cx);
  const sz = grid.cellToWorldZ(map, cz);
  const moved = Math.hypot(sx - x, sz - z);
  const inside = grid.inBounds(map, cx, cz);
  if (!inside) {
    movedFar.push({ kind, id, from: [x, z], reason: "outside the map extent" });
    return;
  }
  props.push({ kind, ...(id ? { id } : {}), cell: [cx, cz], level: grid.levelAt(map, cx, cz) });
  if (moved > SNAP_WARN) movedFar.push({ kind, id, from: [x, z], to: [sx, sz], moved: +moved.toFixed(3) });
}

for (const g of propGroups) for (const [x, z] of g.points) snapProp(g.kind, x, z);
for (const b of buildings) snapProp("building", b.x, b.z, b.id);

// ── Emit ─────────────────────────────────────────────────────────
// One row per line as digit strings. Compact, but still greppable and
// diffable in review — a terrace edit shows up as a readable change.

function rows(arr) {
  const out = [];
  for (let cz = 0; cz < SIZE; cz++) {
    let s = "";
    for (let cx = 0; cx < SIZE; cx++) s += String(arr[cz * SIZE + cx]);
    out.push(s);
  }
  return out;
}

const outArg = process.argv.indexOf("--out");
const outPath = path.join(WEB, outArg !== -1 ? process.argv[outArg + 1] : "data/island-map.json");

const doc = {
  $comment:
    "Generated by scripts/snap-world-to-grid.mjs from the pre-grid world. " +
    "Hand-edited from here on — see specs/acnh-system-reference.md. " +
    "levels/surfaces are one row per line, one digit per cell, +X right, +Z down.",
  width: SIZE,
  depth: SIZE,
  originX: map.originX,
  originZ: map.originZ,
  tile: TILE,
  levelStep: LEVEL_STEP,
  surfaceLegend: Object.fromEntries(Object.entries(Surface).map(([k, v]) => [v, k])),
  levels: rows(map.levels),
  surfaces: rows(map.surfaces),
  props,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(doc, null, 1));

// ── Report ───────────────────────────────────────────────────────

const name = (v) => Object.keys(Surface).find((k) => Surface[k] === v) ?? v;
const pct = (n) => ((n / (SIZE * SIZE)) * 100).toFixed(1) + "%";

console.log(`snapped ${SIZE}x${SIZE} cells -> ${path.relative(WEB, outPath)}\n`);
console.log(`terrain height range: ${minHeight.toFixed(2)} .. ${maxHeight.toFixed(2)}  (one step = ${LEVEL_STEP})`);
console.log("levels:");
for (const [lvl, n] of [...levelHistogram].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${lvl}  ${String(n).padStart(6)}  ${pct(n)}`);
}
console.log("surfaces:");
for (const [s, n] of [...surfaceHistogram].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(name(s)).padEnd(7)} ${String(n).padStart(6)}  ${pct(n)}`);
}
console.log(`\nprops snapped: ${props.length}`);
console.log(`moved more than half a tile: ${movedFar.length}`);
for (const m of movedFar.slice(0, 20)) {
  console.log(
    `  ${m.kind}${m.id ? ` ${m.id}` : ""} ${m.reason ?? `[${m.from}] -> [${m.to.map((v) => v.toFixed(2))}] (${m.moved}u)`}`
  );
}
if (movedFar.length > 20) console.log(`  ... and ${movedFar.length - 20} more`);
