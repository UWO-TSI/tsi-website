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

/**
 * Levels per cliff. Since 2026-07-28 a level is a HALF step: one level (0.75u)
 * is a bank you walk up, two (1.5u) is a cliff you cannot. Everything this
 * script builds is phrased in multiples of it, so an upland terrace asks for
 * `CLIFF` and gets a wall, and a ramp asks for 1 and gets a slope.
 */
const CLIFF = grid.CLIFF_LEVELS;

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

/**
 * Cells of flat beach between the elevation and the sea.
 *
 * David, 2026-07-27: "game looks like minecraft now". The dominant blocky read
 * was the island's own SILHOUETTE — level-1 land ran straight into the water,
 * so the coast was a flight of cliff stairs descending one cell per row. ACNH
 * never shows that, for a reason that is a rule and not an accident: its
 * shoreline is always a flat level-0 beach, and cliffs only ever start inland.
 * The outline you see against the sea is therefore a smooth sand curve, which
 * `easedCellOutline` can round, rather than a stack of square rock pieces,
 * which it cannot.
 */
const COAST_APRON = 4;

/**
 * World-unit radius around the island centre that stays dead flat.
 *
 * David, 2026-07-29: "should have less hills and flatter ground near the center
 * of the island." Measured before the change, the centre was already flat to
 * about r15 in cells, but the 25-35 band was 32% raised, so the plain the
 * village sits on was smaller than it looked. Nothing may raise inside this.
 *
 * 30 rather than 22: at 22 the level histogram improved (L2 19.9% -> 7.1%) but
 * the AMOUNT of raised ground barely moved -- 32% at r25-35, 50% at r35-45 --
 * because the uplands sit outside 22 anyway. Only pushing the protected disc
 * past them reduces the hill count rather than just their height.
 */
const CENTRE_FLAT = 34;

/** Chebyshev distance to the open sea, so the apron can be enforced. */
const seaDist = (() => {
  const d = new Int32Array(map.width * map.depth).fill(1 << 29);
  const queue = [];
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      const i = grid.cellIndex(map, cx, cz);
      if (grid.isVoid(map.surfaces[i])) {
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
  isLand(cx, cz) &&
  clearance[grid.cellIndex(map, cx, cz)] >= MARGIN &&
  seaDist[grid.cellIndex(map, cx, cz)] >= COAST_APRON &&
  Math.hypot(wx(cx), wz(cz)) >= CENTRE_FLAT;

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
function blob(name, x, z, radius, level, force = false, taper = CLIFF) {
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
      const want = level <= taper ? level : t < 0.62 ? level : level - taper;
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
// MOSTLY FLAT (David, 2026-07-29). One level is now a full 1.5u cliff, so every
// raised region is a hard wall you cannot walk up -- six overlapping uplands
// covering half the island read as a maze rather than as terrain. Reduced to
// three, and the saddle and headland are gone entirely.
const UPLAND = [
  ["upland west", -22, -42, 12],
  ["upland centre", -6, -44, 13],
  ["upland east", 14, -34, 10],
];
// LEVEL 1, NOT CLIFF (David, 2026-07-29: "1 block height difference should be
// eased and look like natural slight height changes"). Raising straight to
// CLIFF made every upland a 2-level jump from the plain, which is a cliff by
// definition -- that is how 20% of the land ended up at L2 with 303 cliff
// cells. One level reads as a rise you walk up.
for (const [name, x, z, r] of UPLAND) report.push(blob(name, x, z, r, 1, false, 1));

// A second level so the island has a summit and not just one flat shelf. It
// insets off the level-1 mass it sits inside, which is the ACNH rule and also
// what makes the terrace read as terrain from ground level.
// The island's one genuine cliff feature. At 2*CLIFF it was 4 levels up, which
// with the uplands now at 1 would be a 3-level face that no kit piece can draw
// and enforceSteps would cascade back down anyway. CLIFF puts it exactly one
// cliff above its own shoulder.
// ONE terrace, not two. At 1.5u per level a second terrace is 3u of wall
// stacked in two pieces, which is the tallest thing on the island by a long way
// and reads as a fortress. The upland is the high ground; it does not need a
// peak on top of it.
report.push(blob("upland summit", -10, -43, 7, 1));

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
report.push(blob("temple shoulder", 0, 31.8, 13, CLIFF, true));

// 3. The far side needs relief too, or half the island is a lawn. Same rule:
//    the widest pockets clear of the road grid.
// Two, not four. The spurs were thin slivers that became one-cell-wide walls.
const FARSIDE = [
  ["farside east", 38, 30, 11],
  ["farside west", -36, 26, 10],
];
for (const [name, x, z, r] of FARSIDE) report.push(blob(name, x, z, r, 1, false, 1));

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
// Pulled in from 47.5 to 42 on 2026-07-27. At 47.5 the shelves sat ON the
// beach, which is what made the island's outline a flight of stairs. At 42 they
// stand a few cells inland and read as a low rock bluff LOOKING OVER the sand,
// which is the same silhouette ACNH gets and still answers the original ask.
const SHELF_COAST_DIST = 42;
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

// THREE, not seven. At one-level-equals-one-cliff, seven shelves put a ring of
// hard walls around the rim and the island's outline became a fortification.
// Three reads as a few rocky bluffs looking over the sand, which was the
// original intent.
const SHELVES = [
  ["shelf 110deg", 110, 5.5],
  ["shelf 250deg", 250, 5.5],
  ["shelf 320deg", 320, 5.0],
];
for (const [name, deg, r] of SHELVES) {
  const a = (deg * Math.PI) / 180;
  const rad = radiusAtCoastDist(deg, SHELF_COAST_DIST);
  // ONE level, not CLIFF. At CLIFF these seven shelves put a 2-level face
  // around the island's rim, which is what made the outline read as a flight of
  // stairs (David: "should be the same with corners of island").
  report.push(blob(name, Math.cos(a) * rad, Math.sin(a) * rad, r, 1));
}

// ── Ramps ────────────────────────────────────────────────────────

/**
 * Place a ramp into every raised region that would otherwise be unreachable.
 *
 * MEASURED NEED. With every level change a hard cliff, a flood fill that can
 * only step between cells of equal level broke the island into 7 disconnected
 * regions, stranding 2394 of 10833 walkable cells -- 22%. Ramps are not
 * decoration here, they are the only way the terrain is traversable.
 *
 * The algorithm is deliberately dumb and deterministic: grow the reachable set
 * from the largest region, then repeatedly find the best cliff edge touching it
 * and cut a ramp there, until nothing is left stranded.
 *
 * "Best" prefers a site with flat ground on BOTH sides -- a ramp landing in a
 * one-cell notch is unusable however correct the geometry is -- and among those
 * the widest, so ramps land on open ground rather than on a spur.
 */
function placeRamps() {
  const W = map.width, D = map.depth;
  const walk = (x, z) =>
    x >= 0 && z >= 0 && x < W && z < D &&
    !grid.isVoid(grid.surfaceAt(map, x, z)) && !grid.isRiver(grid.surfaceAt(map, x, z));
  const lvl = (x, z) => grid.levelAt(map, x, z);
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /** Cells reachable from `seeds` stepping only between equal levels or via a ramp. */
  const reach = (seeds) => {
    const seen = new Uint8Array(W * D);
    const st = [...seeds];
    while (st.length) {
      const [x, z] = st.pop();
      const i = z * W + x;
      if (seen[i] || !walk(x, z)) continue;
      seen[i] = 1;
      for (const [dx, dz] of ORTH) {
        const nx = x + dx, nz = z + dz;
        if (!walk(nx, nz)) continue;
        const isRamp = grid.isRamp(grid.surfaceAt(map, nx, nz)) || grid.isRamp(grid.surfaceAt(map, x, z));
        if (lvl(nx, nz) === lvl(x, z) || isRamp) st.push([nx, nz]);
      }
    }
    return seen;
  };

  /** Every equal-level component, biggest first. */
  const components = () => {
    const seen = new Uint8Array(W * D), out = [];
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (seen[i] || !walk(x, z)) continue;
      const cells = [], st = [[x, z]];
      while (st.length) {
        const [a, b] = st.pop(), j = b * W + a;
        if (seen[j] || !walk(a, b)) continue;
        seen[j] = 1; cells.push([a, b]);
        for (const [dx, dz] of ORTH) if (walk(a + dx, b + dz) && lvl(a + dx, b + dz) === lvl(a, b)) st.push([a + dx, b + dz]);
      }
      out.push(cells);
    }
    return out.sort((a, b) => b.length - a.length);
  };

  const comps = components();
  if (!comps.length) return [];
  const placed = [];
  let seen = reach([comps[0][0]]);

  // At most one ramp per stranded component per pass, and a hard cap so a
  // pathological map cannot spin here.
  for (let pass = 0; pass < 40; pass++) {
    const stranded = comps.filter((c) => !seen[c[0][1] * W + c[0][0]] && c.length >= 6);
    if (!stranded.length) break;

    let best = null;
    for (const comp of stranded) {
      for (const [x, z] of comp) {
        for (const [dx, dz] of ORTH) {
          const lx = x + dx, lz = z + dz;
          // The low cell must be reachable and exactly one level down.
          if (!walk(lx, lz) || !seen[lz * W + lx]) continue;
          if (lvl(x, z) - lvl(lx, lz) !== 1) continue;
          // Score: flat neighbours on both sides, so the ramp lands on open
          // ground rather than in a notch.
          let openLow = 0, openHigh = 0;
          for (const [ax, az] of ORTH) {
            if (walk(lx + ax, lz + az) && lvl(lx + ax, lz + az) === lvl(lx, lz)) openLow++;
            if (walk(x + ax, z + az) && lvl(x + ax, z + az) === lvl(x, z)) openHigh++;
          }
          const score = openLow + openHigh;
          if (!best || score > best.score) best = { lx, lz, dx, dz, score, size: comp.length };
        }
      }
    }
    if (!best) break;

    // The ramp occupies the LOW cell: stored at the lower level, climbing dx/dz.
    grid.setCell(map, best.lx, best.lz, lvl(best.lx, best.lz), grid.Surface.Ramp);
    placed.push(best);
    seen = reach([comps[0][0]]);
  }
  return placed;
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
        // A face taller than one cliff piece has NOTHING to draw it — the kit
        // is 1.5u and does not stack. So the legal maximum between neighbours
        // is exactly CLIFF levels, which is also what makes each tier inset.
        if (lvl - lowest > CLIFF) {
          map.levels[i] = lowest + CLIFF;
          changed++;
        }
      }
    }
    passes++;
    if (!changed || passes > 32) return { passes, settled: !changed };
  }
}

/**
 * Straighten level boundaries — the other half of "eases land connections".
 *
 * A blob rasterised onto a grid gives an edge that jitters by one cell every
 * row or two, and a one-cell jitter renders as one square rock piece jutting
 * out of an otherwise straight wall. Fifty of those in a row is the staircase.
 *
 * A 3x3 majority vote fixes it: a cell joins the plateau when 5 or more of its
 * nine neighbours (itself included) are raised, and leaves when fewer are. On a
 * straight edge every cell already has exactly the majority it needs, so
 * straight edges are FIXED POINTS and only the jitter moves. Two rounds settle
 * it; more would start rounding off deliberate corners.
 *
 * Bounded by `canRaise` on the way up so this cannot walk a plateau back over a
 * road or into the coastal apron.
 */
function straighten(rounds) {
  let flipped = 0;
  for (let r = 0; r < rounds; r++) {
    const next = Uint8Array.from(map.levels);
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        if (!isLand(cx, cz) || isProtected(cx, cz)) continue;
        const i = grid.cellIndex(map, cx, cz);
        const lvl = map.levels[i];
        // Vote on the boundary of THIS cell's own tier, so a level-2 summit
        // straightens against level 1 rather than against the sea.
        const tier = Math.max(1, lvl === 0 ? 1 : lvl);
        let votes = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            // Off-map reads as sea, i.e. not part of the tier.
            if (!isLand(nx, nz)) continue;
            if (map.levels[grid.cellIndex(map, nx, nz)] >= tier) votes++;
          }
        }
        const want = votes >= 5;
        const has = lvl >= tier;
        if (want === has) continue;
        if (want && !canRaise(cx, cz)) continue;
        next[i] = want ? tier : tier - 1;
        flipped++;
      }
    }
    map.levels.set(next);
  }
  return flipped;
}

/**
 * RAMPS — the leveling rule that makes a plateau reachable.
 *
 * A terrace built at level CLIFF sits behind a 1.5u wall on every side, which
 * is exactly what a cliff is and exactly why you cannot get onto it. ACNH
 * solves this with an incline kit; the dump has none (searched — `FldUISlope`
 * is a UI icon, and there is no ramp, stair or slope model anywhere in the
 * 57,822 entries). So the ramp is built out of the terrain itself, which the
 * half-step scale now makes possible:
 *
 *   ground 0  ->  ramp 1  ->  terrace 2
 *
 * Each of those is a single level, so each is a walkable 0.75u bank and none of
 * them is a cliff. The cliff autotiler agrees for free: `sameLevelOrHigher`
 * treats a one-level neighbour as the same tier, so the terrace grows no wall
 * where the ramp meets it and the ramp appears as a gap in the cliff run.
 *
 * One ramp per plateau, placed at whichever of its boundary cells is closest to
 * a road — because the point of the ramp is that a path can reach it.
 */
function carveRamps(radius) {
  const W = map.width;
  const D = map.depth;
  const seen = new Uint8Array(W * D);
  const ramps = [];

  for (let cz = 0; cz < D; cz++) {
    for (let cx = 0; cx < W; cx++) {
      const start = grid.cellIndex(map, cx, cz);
      if (seen[start] || map.levels[start] < CLIFF || !isLand(cx, cz)) continue;

      // Flood the plateau, tracking the boundary cell nearest to a road.
      const stack = [start];
      seen[start] = 1;
      let best = null;
      let bestDist = Infinity;
      let size = 0;
      while (stack.length) {
        const i = stack.pop();
        const z = Math.floor(i / W);
        const x = i % W;
        size++;
        let onEdge = false;
        for (const [dx, dz] of grid.ORTHOGONAL) {
          const nx = x + dx;
          const nz = z + dz;
          if (!isLand(nx, nz)) continue;
          const n = grid.cellIndex(map, nx, nz);
          if (map.levels[n] >= CLIFF) {
            if (!seen[n]) {
              seen[n] = 1;
              stack.push(n);
            }
          } else {
            onEdge = true;
          }
        }
        if (!onEdge) continue;
        const d = clearance[i];
        if (d < bestDist) {
          bestDist = d;
          best = [x, z];
        }
      }

      // A plateau too small to stand on does not need a way up.
      if (!best || size < 12) continue;

      // Set the ramp disc to level 1. `blob`-style: only ever raises, so the
      // terrace keeps its own height and only the ground outside steps up.
      let cells = 0;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dz * dz > radius * radius) continue;
          const rx = best[0] + dx;
          const rz = best[1] + dz;
          if (!isLand(rx, rz) || isProtected(rx, rz)) continue;
          const i = grid.cellIndex(map, rx, rz);
          if (map.levels[i] >= 1) continue;
          map.levels[i] = 1;
          cells++;
        }
      }
      ramps.push({ at: best, cells, plateau: size });
    }
  }
  return ramps;
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
const flipped = straighten(2);
// Ramps AFTER open/straighten: both work on "is this cell raised at all", and
// a 2-cell ramp disc is exactly the kind of thin feature open(2) deletes.
const ramps = carveRamps(3);
const stepFix = enforceSteps();
const specks = removeSpecks();
enforceSteps();
// LAST, and that ordering matters. A ramp is a single cell, which is exactly
// what removeSpecks deletes and what enforceSteps would flatten back. Placing
// them after both means nothing downstream can undo the only routes onto the
// high ground. (Not to be confused with carveRamps above, which cuts terraced
// ramp SHAPES into the level field; this marks Surface.Ramp cells.)
const rampsPlaced = placeRamps();

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
  `\nopen(2) dropped: ${opened} · straighten(2) flipped: ${flipped} · ramps carved: ${ramps.length} · constraint passes: ${stepFix.passes} (settled: ${stepFix.settled}) · specks removed: ${specks}`
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
let cornerCells = 0;
let coastCliff = 0;
let bankCells = 0;
let cliffFaceCells = 0;
for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    if (!isLand(cx, cz)) continue;
    const lvl = map.levels[grid.cellIndex(map, cx, cz)];
    if (lvl === 0) continue;
    raisedCells++;
    const below = (dx, dz) =>
      (isLand(cx + dx, cz + dz) ? map.levels[grid.cellIndex(map, cx + dx, cz + dz)] : 0) < lvl;
    const orth = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dz]) => below(dx, dz)).length;
    if (grid.DIR_OFFSETS.some(([dx, dz]) => below(dx, dz))) edgeCells++;
    // The number that matters now: how much of the relief is a walkable bank
    // and how much is a wall. David 2026-07-28 wants most of it walkable.
    const worst = Math.max(
      ...grid.DIR_OFFSETS.map(([dx, dz]) =>
        lvl - (isLand(cx + dx, cz + dz) ? map.levels[grid.cellIndex(map, cx + dx, cz + dz)] : 0)
      )
    );
    if (worst >= CLIFF) cliffFaceCells++;
    else if (worst > 0) bankCells++;
    // Two or more lower orthogonals means the wall TURNS here. A long straight
    // run has one; a staircase has one at every single cell, which is what
    // reads as Minecraft. This is the number `straighten()` exists to drive
    // down.
    if (orth >= 2) cornerCells++;
    if ((below(-1, 0) && below(1, 0)) || (below(0, -1) && below(0, 1))) thinCells++;
    if (seaDist[grid.cellIndex(map, cx, cz)] < COAST_APRON) coastCliff++;
  }
}
console.log(
  `cliff edges: ${cliffEdges} · edge cells ${edgeCells}/${raisedCells} = ${(
    (100 * edgeCells) /
    Math.max(1, raisedCells)
  ).toFixed(0)}% · 1-cell-wide ridges: ${thinCells}`
);
console.log(
  `relief: ${bankCells} walkable bank cells (${(
    (100 * bankCells) /
    Math.max(1, bankCells + cliffFaceCells)
  ).toFixed(0)}%) vs ${cliffFaceCells} cliff-face cells — one level is ${
    grid.LEVEL_STEP
  }u, a cliff is ${grid.CLIFF_HEIGHT}u`
);
console.log(
  `corner (wall turns here) cells: ${cornerCells}/${edgeCells} = ${(
    (100 * cornerCells) /
    Math.max(1, edgeCells)
  ).toFixed(0)}% of the perimeter · cliff inside the ${COAST_APRON}-cell beach apron: ${coastCliff}`
);

if (dry) {
  console.log("\n--dry: not written");
} else {
  const out = { ...doc, ...grid.serialiseIslandMap(map, props) };
  fs.writeFileSync(MAP_PATH, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${path.relative(WEB, MAP_PATH)}`);
}
