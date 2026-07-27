#!/usr/bin/env node
/**
 * author-elevation — put real terracing into data/island-map.json
 * (David ask, 2026-07-26: "a bit of elevation and terrain change, maybe some
 * natural small cliffs from rocks near the water").
 *
 *   node scripts/author-elevation.mjs [--dry]
 *
 * The snap could only ever produce a flat island: the pre-grid world spanned
 * ~1.4u of relief inside a 1.5u step, so 98% of it landed on level 0. Relief
 * has to be AUTHORED. This script is where that authoring lives, declaratively,
 * so it can be reviewed, re-run and argued with — rather than 16k hand-edited
 * digits.
 *
 * It is idempotent: every feature SETS an absolute level, so running twice
 * gives the same map.
 *
 * THE RULES IT ENFORCES (specs/acnh-system-reference.md §1):
 *   · levels 0..3
 *   · adjacent cells never differ by more than one level, which is what
 *     produces ACNH's "each layer insets one tile from the one below" — a
 *     2-level drop has no cliff piece and would read as a wall
 *   · protected cells never move: roads, the river and its banks, and a
 *     margin around every building. Those carry content that assumes flat
 *     ground, and inclines are not built yet.
 */

import fs from "fs";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const grid = await import(path.join(WEB, "lib/game/grid.ts"));
const coast = await import(path.join(WEB, "lib/game/coast.ts"));

const MAP_PATH = path.join(WEB, "data/island-map.json");
const dry = process.argv.includes("--dry");

const doc = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
const { map, props } = grid.parseIslandMap(doc);

const wx = (cx) => grid.cellToWorldX(map, cx);
const wz = (cz) => grid.cellToWorldZ(map, cz);

// ── Protection ───────────────────────────────────────────────────

const roadSrc = fs.readFileSync(path.join(WEB, "components/game/RoadTiles.tsx"), "utf8");
const roadRects = (() => {
  const m = /const\s+RECTS\b[^=]*=\s*\[/.exec(roadSrc);
  if (!m) return [];
  let i = m.index + m[0].length - 1;
  let depth = 0;
  let end = i;
  for (; i < roadSrc.length; i++) {
    if (roadSrc[i] === "[") depth++;
    else if (roadSrc[i] === "]" && --depth === 0) {
      end = i;
      break;
    }
  }
  return [...roadSrc.slice(m.index, end + 1).matchAll(
    /\{\s*x0:\s*(-?[\d.]+),\s*x1:\s*(-?[\d.]+),\s*z0:\s*(-?[\d.]+),\s*z1:\s*(-?[\d.]+)\s*\}/g
  )].map((r) => ({ x0: +r[1], x1: +r[2], z0: +r[3], z1: +r[4] }));
})();

const BUILDING_CLEAR = 3; // cells of flat ground around a building footprint
const RIVER_CLEAR = 2; // cells of flat bank either side of the channel

const protectedCells = new Uint8Array(map.width * map.depth);

function protect(cx, cz) {
  if (grid.inBounds(map, cx, cz)) protectedCells[grid.cellIndex(map, cx, cz)] = 1;
}

for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    const x = wx(cx);
    const z = wz(cz);

    // Roads and the plaza: a level change across a path needs an incline,
    // and the incline kit is not wired yet.
    for (const r of roadRects) {
      if (x >= r.x0 - 1 && x <= r.x1 + 1 && z >= r.z0 - 1 && z <= r.z1 + 1) protect(cx, cz);
    }

    // The river and its banks. Raising a bank would break the channel, and
    // raising the channel would strand the water.
    if (grid.isRiver(grid.surfaceAt(map, cx, cz))) {
      for (let dz = -RIVER_CLEAR; dz <= RIVER_CLEAR; dz++) {
        for (let dx = -RIVER_CLEAR; dx <= RIVER_CLEAR; dx++) protect(cx + dx, cz + dz);
      }
    }
  }
}

for (const p of props) {
  if (p.kind !== "building") continue;
  const [bx, bz] = p.cell;
  for (let dz = -BUILDING_CLEAR; dz <= BUILDING_CLEAR; dz++) {
    for (let dx = -BUILDING_CLEAR; dx <= BUILDING_CLEAR; dx++) protect(bx + dx, bz + dz);
  }
}

const isProtected = (cx, cz) =>
  !grid.inBounds(map, cx, cz) || protectedCells[grid.cellIndex(map, cx, cz)] === 1;
const isLand = (cx, cz) => grid.inBounds(map, cx, cz) && !grid.isVoid(grid.surfaceAt(map, cx, cz));

// ── Clearance ────────────────────────────────────────────────────
//
// WHY THIS EXISTS. The first pass just skipped protected cells inside the
// blob loop, which meant every road punched a level-0 slot straight through
// whatever plateau it crossed. The result measured 42% of raised cells sitting
// on a cliff edge: the uplands came out as ribbons two or three cells wide
// wrapping the road network, and in 3D they read as garden edging and as
// canyon walls flanking the main avenue. Not terrain.
//
// A landform needs a FLAT APRON between it and anything that assumes flat
// ground. So: Chebyshev distance from every cell to the nearest protected one,
// and a blob may only raise a cell that is at least MARGIN away. The plateau
// edge is then its own smooth offset curve rather than the road's outline.
//
// The sea is NOT a blocker here. A shelf that runs into the water and drops a
// rock face onto the beach is the point (David's ask), so it must be allowed
// to touch the coast.
const MARGIN = 3;

const clearance = (() => {
  const d = new Int32Array(map.width * map.depth).fill(1 << 29);
  const queue = [];
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      const i = grid.cellIndex(map, cx, cz);
      if (protectedCells[i]) {
        d[i] = 0;
        queue.push(i);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const cz = Math.floor(i / map.width);
    const cx = i % map.width;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!grid.inBounds(map, cx + dx, cz + dz)) continue;
        const n = grid.cellIndex(map, cx + dx, cz + dz);
        if (d[n] > d[i] + 1) {
          d[n] = d[i] + 1;
          queue.push(n);
        }
      }
    }
  }
  return d;
})();

const canRaise = (cx, cz) =>
  isLand(cx, cz) && clearance[grid.cellIndex(map, cx, cz)] >= MARGIN;

// ── Features ─────────────────────────────────────────────────────
// World coordinates throughout, so these read against the same numbers the
// rest of the codebase uses. +Z is "north" in GameWorld's naming.

/**
 * Raise land inside a blob, keeping MARGIN cells of flat apron around anything
 * protected.
 *
 * A level-1 blob fills its whole radius. Only level 2 and up taper, because
 * only then is there a lower terrace for the rim to inset onto — the earlier
 * `t < 0.55` taper applied to level 1 meant the outer 45% of every radius
 * resolved to level 0, so every stated radius was silently 45% too small and
 * the uplands came out as coins.
 */
function blob(name, x, z, radius, level, force = false) {
  let applied = 0;
  const r2 = radius * radius;
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (force ? !isLand(cx, cz) : !canRaise(cx, cz)) continue;
      const dx = wx(cx) - x;
      const dz = wz(cz) - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const t = Math.sqrt(d2) / radius;
      const want = level === 1 ? 1 : t < 0.62 ? level : level - 1;
      if (want <= 0) continue;
      const i = grid.cellIndex(map, cx, cz);
      if (force) forced[i] = 1;
      if (map.levels[i] < want) {
        map.levels[i] = want;
        applied++;
      }
    }
  }
  return { name, cells: applied };
}

/**
 * Morphological OPEN (erode then dilate) on the raised set.
 *
 * Overlapping blobs minus the road apron still leaves isthmuses and spurs a
 * cell or two wide. Those are the fragments that render as a brown box dropped
 * on the lawn. Opening at radius R deletes anything thinner than 2R+1 cells
 * and leaves everything fatter untouched, which is exactly the filter wanted.
 *
 * Erosion treats the SEA as solid so a shelf that meets the water keeps its
 * mass; dilation is masked by `canRaise` so nothing grows back over a road.
 */
function open(radius) {
  const raised = new Uint8Array(map.width * map.depth);
  for (let i = 0; i < map.levels.length; i++) raised[i] = map.levels[i] > 0 ? 1 : 0;

  // Erosion: keep a cell only if it and all 8 neighbours are set. Off-map and
  // sea read as set, so the seaward lip of a coastal shelf survives.
  const erode = (src) => {
    const out = new Uint8Array(src.length);
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        const i = grid.cellIndex(map, cx, cz);
        if (!src[i]) continue;
        let all = true;
        for (let dz = -1; dz <= 1 && all; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (!grid.inBounds(map, nx, nz) || !isLand(nx, nz)) continue;
            if (!src[grid.cellIndex(map, nx, nz)]) {
              all = false;
              break;
            }
          }
        }
        out[i] = all ? 1 : 0;
      }
    }
    return out;
  };

  // Dilation: set a cell if it or any neighbour is set.
  const dilate = (src) => {
    const out = new Uint8Array(src.length);
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        let any = false;
        for (let dz = -1; dz <= 1 && !any; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (grid.inBounds(map, nx, nz) && src[grid.cellIndex(map, nx, nz)]) {
              any = true;
              break;
            }
          }
        }
        out[grid.cellIndex(map, cx, cz)] = any ? 1 : 0;
      }
    }
    return out;
  };

  let cur = raised;
  for (let r = 0; r < radius; r++) cur = erode(cur);
  for (let r = 0; r < radius; r++) cur = dilate(cur);

  let dropped = 0;
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      const i = grid.cellIndex(map, cx, cz);
      if (isProtected(cx, cz) || !isLand(cx, cz)) continue;
      const want = cur[i] && canRaise(cx, cz);
      if (!want && map.levels[i] > 0) {
        map.levels[i] = 0;
        dropped++;
      }
    }
  }
  return dropped;
}

// Elevation is authored HERE and nowhere else. Reset unprotected land to zero
// first so this script is authoritative: re-running after a parameter change
// gives the same map rather than layering new relief on old. The snap's own
// 1.8% of raised cells were an artifact of rounding a smooth heightfield, not
// a design, so there is nothing to preserve.
for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    if (isLand(cx, cz) && !isProtected(cx, cz)) map.levels[grid.cellIndex(map, cx, cz)] = 0;
  }
}

const levelsBefore = Uint8Array.from(map.levels);
/** Cells a `force` feature deliberately claimed, exempt from the audit below. */
const forced = new Uint8Array(map.width * map.depth);
const report = [];

// 1. UPLAND. Deliberately NOT a half-plane: cutting the island at a fixed Z
//    drew a dead-straight cliff from coast to coast, which reads as a retaining
//    wall, not a landform. A union of overlapping blobs of different sizes
//    gives a wandering edge instead, which is what the reference screenshots
//    have. Sited on the far side (-Z), the emptiest part of the map: no roads
//    except the south avenue at z = -13, and the ambient chalets sit at
//    z ~ -18, both well clear.
// Equal circles in a row still read as coins. Vary the radii, overlap them
// hard, and run the mass into the west coast so it terminates in a headland
// rather than floating in a field.
// Sited on the widest open pockets the clearance field actually reports, not
// on eyeballed coordinates: the centres below are the local maxima of distance
// to the nearest road, bank or building, so each blob has room to be a mass
// rather than a ribbon squeezed between two paths.
const UPLAND = [
  ["upland west", -24, -42, 14],
  ["upland centre", -10, -44, 14],
  ["upland c-east", 4, -41, 13],
  ["upland east", 17, -32, 12],
  ["upland saddle", -16, -30, 11],
  ["upland headland", -38, -36, 9],
];
for (const [name, x, z, r] of UPLAND) report.push(blob(name, x, z, r, 1));

// A second level so the island has a summit and not just one flat shelf. It
// insets off the level-1 mass it sits inside, which is the ACNH rule and also
// what makes the terrace read as terrain from ground level.
report.push(blob("upland summit", -12, -42, 11, 2));

// 2. Temple Rise. Its platform is level 2 sitting directly on level 0, which
//    is an illegal 2-step face — there is no cliff piece for it. The shoulder
//    that fixes it has to be FORCED past the margin rule, because the platform
//    is ringed by its own building clearance and the shoulder would otherwise
//    be pushed 3 cells out and leave the illegal face standing.
//
//    Forcing is safe here for the reason the clearance exists at all: a
//    building apron must be FLAT, not level 0. Raising the whole apron one
//    step keeps it flat. What is forbidden is a level change inside the apron,
//    and a blob wider than the apron cannot make one.
report.push(blob("temple shoulder", 0, 31.8, 13, 1, true));

// 3. The far side needs relief too, or half the island is a lawn. Same rule:
//    the widest pockets clear of the road grid.
const FARSIDE = [
  ["farside east", 37, 32, 12],
  ["farside e-spur", 48, 23, 9],
  ["farside west", -35, 26, 10],
  ["farside w-spur", -46, 17, 9],
];
for (const [name, x, z, r] of FARSIDE) report.push(blob(name, x, z, r, 1));

// 3. ROCKY SHELVES AT THE WATERLINE — the specific ask. These have to STRADDLE
//    the coast to read as rocks at the water: sand starts at coastDist 48.5
//    and the waterline is 51.4, so a blob centred at radius ~46 spans roughly
//    41..51 and drops its cliff face straight onto the beach. Centred inland
//    (the first attempt) they were just bumps in a field.
//
//    Angles avoid the two river mouths (~177 and ~357 degrees), the beach cove
//    at ~70, and the wharf at ~356.
// coastDist subtracts an angular wobble, so a fixed radius is NOT a fixed
// distance from the water — at angles where the coast bulges, radius 46 sits
// well inland, which is exactly how the first attempt ended up as bumps in a
// field. Solve for the radius where coastDist hits the target instead.
const SHELF_COAST_DIST = 47.5; // just inside the 48.5 grass->sand blend
function radiusAtCoastDist(deg, target) {
  const a = (deg * Math.PI) / 180;
  let lo = 10;
  let hi = 80;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (coast.coastDist(Math.cos(a) * mid, Math.sin(a) * mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const SHELVES = [
  ["shelf 35deg", 35, 5.0],
  ["shelf 110deg", 110, 5.5],
  ["shelf 140deg", 140, 4.5],
  ["shelf 215deg", 215, 5.0],
  ["shelf 250deg", 250, 5.5],
  ["shelf 285deg", 285, 4.5],
  ["shelf 320deg", 320, 5.0],
];
for (const [name, deg, r] of SHELVES) {
  const a = (deg * Math.PI) / 180;
  const rad = radiusAtCoastDist(deg, SHELF_COAST_DIST);
  report.push(blob(name, Math.cos(a) * rad, Math.sin(a) * rad, r, 1));
}

// ── Constraints ──────────────────────────────────────────────────

/**
 * No adjacent pair may differ by more than one level. Lowering the higher
 * cell (rather than raising the lower) keeps protected flat ground flat and
 * makes the terraces inset, which is the ACNH rule. Iterates to a fixed point.
 */
function enforceSteps() {
  let passes = 0;
  for (;;) {
    let changed = 0;
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        if (!isLand(cx, cz)) continue;
        const i = grid.cellIndex(map, cx, cz);
        const lvl = map.levels[i];
        if (lvl === 0) continue;
        let lowest = lvl;
        for (const [dx, dz] of grid.DIR_OFFSETS) {
          const nx = cx + dx;
          const nz = cz + dz;
          // Off-map and sea both read as level 0, so a cliff at the coast is
          // legal and expected — that is the "rocks at the water" silhouette.
          const nl = isLand(nx, nz) ? map.levels[grid.cellIndex(map, nx, nz)] : 0;
          if (nl < lowest) lowest = nl;
        }
        if (lvl - lowest > 1) {
          map.levels[i] = lowest + 1;
          changed++;
        }
      }
    }
    passes++;
    if (!changed || passes > 32) return { passes, settled: !changed };
  }
}

/** A single raised cell with no raised neighbour is noise, not a landform. */
function removeSpecks() {
  let removed = 0;
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (!isLand(cx, cz)) continue;
      const i = grid.cellIndex(map, cx, cz);
      const lvl = map.levels[i];
      if (lvl === 0) continue;
      let peers = 0;
      for (const [dx, dz] of grid.DIR_OFFSETS) {
        if (isLand(cx + dx, cz + dz) && map.levels[grid.cellIndex(map, cx + dx, cz + dz)] >= lvl) peers++;
      }
      if (peers <= 1) {
        map.levels[i] = lvl - 1;
        removed++;
      }
    }
  }
  return removed;
}

// Open first: deleting ribbons before terracing means enforceSteps only has
// to resolve real terraces, not artifacts.
const opened = open(2);
const stepFix = enforceSteps();
const specks = removeSpecks();
enforceSteps();

// Protected cells must be untouched. Checking "still zero" would be wrong —
// some protected ground (the temple platform) is legitimately raised. What
// matters is that THIS script did not move it.
let violations = 0;
for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    const i = grid.cellIndex(map, cx, cz);
    if (forced[i]) continue;
    if (isProtected(cx, cz) && isLand(cx, cz) && map.levels[i] !== levelsBefore[i]) violations++;
  }
}

// Props inherit the level of the cell they stand on.
for (const p of props) p.level = grid.levelAt(map, p.cell[0], p.cell[1]);

// ── Report ───────────────────────────────────────────────────────

const hist = new Map();
let land = 0;
for (let i = 0; i < map.levels.length; i++) {
  if (grid.isVoid(map.surfaces[i])) continue;
  land++;
  hist.set(map.levels[i], (hist.get(map.levels[i]) ?? 0) + 1);
}

console.log("features applied:");
for (const r of report) console.log(`  ${r.name.padEnd(26)} ${String(r.cells).padStart(5)} cells raised`);
console.log(
  `\nopen(2) dropped: ${opened} · constraint passes: ${stepFix.passes} (settled: ${stepFix.settled}) · specks removed: ${specks}`
);
console.log(`protected cells modified: ${violations}${violations ? "  <<< BUG" : ""}`);
console.log("\nlevels over land:");
for (const [lvl, n] of [...hist].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${lvl}  ${String(n).padStart(6)}  ${((n / land) * 100).toFixed(1)}%`);
}

// How much cliff edge we created — the thing that actually shows up in 3D.
let cliffEdges = 0;
for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    if (!isLand(cx, cz)) continue;
    const lvl = map.levels[grid.cellIndex(map, cx, cz)];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nl = isLand(cx + dx, cz + dz) ? map.levels[grid.cellIndex(map, cx + dx, cz + dz)] : 0;
      if (nl < lvl) cliffEdges++;
    }
  }
}
// The shape metric that actually predicts how it reads in 3D. A plateau whose
// cells are mostly edge is a ribbon, and a ribbon renders as a wall standing in
// a field. The first pass measured 42%; anything under ~25% is a landform.
let raisedCells = 0;
let edgeCells = 0;
let thinCells = 0;
for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    if (!isLand(cx, cz)) continue;
    const lvl = map.levels[grid.cellIndex(map, cx, cz)];
    if (lvl === 0) continue;
    raisedCells++;
    const below = (dx, dz) =>
      (isLand(cx + dx, cz + dz) ? map.levels[grid.cellIndex(map, cx + dx, cz + dz)] : 0) < lvl;
    if (grid.DIR_OFFSETS.some(([dx, dz]) => below(dx, dz))) edgeCells++;
    if ((below(-1, 0) && below(1, 0)) || (below(0, -1) && below(0, 1))) thinCells++;
  }
}
console.log(
  `cliff edges: ${cliffEdges} · edge cells ${edgeCells}/${raisedCells} = ${(
    (100 * edgeCells) /
    Math.max(1, raisedCells)
  ).toFixed(0)}% · 1-cell-wide ridges: ${thinCells}`
);

if (dry) {
  console.log("\n--dry: not written");
} else {
  const out = { ...doc, ...grid.serialiseIslandMap(map, props) };
  fs.writeFileSync(MAP_PATH, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${path.relative(WEB, MAP_PATH)}`);
}
