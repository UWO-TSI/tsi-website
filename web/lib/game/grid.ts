/**
 * grid — the ACNH tile substrate (M2, 2026-07-26).
 *
 * The world is a grid of cells at integer elevation levels, not a deformed
 * surface. ACNH's entire ground plane is `FldUnit/Base_0.dae`: one 4-vertex
 * 10x10 quad. Every visual comes from choosing which piece goes in which cell.
 *
 * This module is pure data — no React, no three.js. It owns:
 *   · the measured constants
 *   · the map representation (two flat Uint8Arrays)
 *   · cell <-> world conversion and height lookup
 *   · the autotile solver shared by the cliff, river and road kits
 *
 * See `specs/acnh-system-reference.md` for where the constants come from and
 * `CLAUDE.md` § "World model" for the rules that follow from them.
 */

// ── Measured constants ───────────────────────────────────────────
// Raw dump units are 10x world units. These were measured off the kit meshes,
// not chosen: Cliff0A_0 puts its top grass at y=0 and the lower level's grass
// at exactly y=-15, and every kit piece bboxes to exactly 10 x 10.

/** One cell, world units. Raw 10.0. */
export const TILE = 1.0;

/**
 * One elevation step, world units.
 *
 * HALVED 2026-07-28 on David's call: "the height for each terrain is too tall,
 * i think it should be half as tall for each inciment, so 0.5 is walkable but a
 * 1 would be considered a cliff."
 *
 * The kit's own step is 1.5 and that is not negotiable — `Cliff0A_0` puts its
 * top grass at y=0 and drops the wall to exactly y=-15 raw, so a cliff piece IS
 * 1.5u of wall. What changes is that 1.5u is now TWO levels rather than one.
 * A single level is a 0.75u bank you walk up; two is a cliff you cannot.
 *
 * That is the whole leveling rule, and it falls out of one number:
 * `CLIFF_LEVELS`.
 */
export const LEVEL_STEP = 0.75;

/**
 * How many levels a cliff piece spans. `CLIFF_LEVELS * LEVEL_STEP` must equal
 * the kit's measured 1.5u wall, so these two constants move together.
 *
 * A drop of fewer levels than this is a BANK: walkable, no kit piece, drawn as
 * a sloped skirt by GridTerrain. A drop of this many or more is a CLIFF.
 */
export const CLIFF_LEVELS = 2;

/** The vertical drop one cliff piece covers, world units. Matches the kit. */
export const CLIFF_HEIGHT = CLIFF_LEVELS * LEVEL_STEP;

/** River surface below its own ground level, world units. Raw 0.78. */
export const WATER_DROP = 0.078;

/**
 * How far the grass fringe hangs past a water edge, world units.
 *
 * Measured from the kit: ACNH drapes grass 1.88 raw units down a cliff face,
 * which is 0.188u. The same strip does the river's edge, and because the water
 * surface is only WATER_DROP (0.078u) below the ground the drape reaches BELOW
 * it -- the blades dip into the water instead of stopping above it, which is
 * what stops the boundary reading as a cut.
 */
export const FRINGE_DROP = 0.188;

/**
 * Grass colour, and the ONE place it is defined.
 *
 * MEASURED off David's ACNH reference (2026-07-30), not guessed. Classifying the
 * screenshot by hue and averaging the sunlit band -- the closest thing in a lit
 * capture to an albedo -- gives #8FA16C: hue 81deg, saturation 0.33.
 *
 * Both previous values missed the same way, and it was not brightness:
 *
 *   0x7CAE56  hue 94deg  sat 0.51   the original, called "too dark"
 *   0x8FC96B  hue 97deg  sat 0.47   my fix -- brighter, still 16deg too green
 *                                   and 42% oversaturated
 *   0x8FA16C  hue 81deg  sat 0.33   the reference
 *
 * So "too dark" was really "too green and too saturated". Raising the value did
 * not touch the actual error, which is why the second attempt looked wrong too.
 * ACNH's grass is a desaturated yellow-olive, not a saturated green.
 *
 * Defined ONCE. It was duplicated across the ground material, both fringe tints
 * and GridTerrain's fallback swatch, so changing it meant finding all four and
 * missing one left a mismatched patch.
 */
export const GRASS_COLOR = 0x8fa16c;

// ── Smooth terrain ───────────────────────────────────────────────

/**
 * How far a one-level change spreads sideways, in cells. David's call,
 * 2026-07-29: about 5.
 *
 * Was 5, which the blur turned into a transition about 8 cells wide at roughly
 * 8 degrees. David, 2026-07-29: "the 8 block 8 degree change is a little over
 * kill" -- and his ACNH reference has no slopes in it at all, only hard cliffs
 * with a rounded grass lip.
 *
 * 3 now, not 2, because the job changed. When every level change was a half step
 * the spread was a direct tax on flat buildable ground, so it had to be tight.
 * Half steps are RARE now -- a level change is normally a full cliff -- and the
 * only reason they exist is island naturalness, so a softer blend is what they
 * are for and it costs almost no flat ground because there are so few.
 */
export const SLOPE_SPREAD = 3;

/**
 * Continuous ground height at every cell CORNER, from the discrete level field.
 *
 * WHY A FIELD AND NOT PER-EDGE SKIRTS. The old `addBank` patched each level
 * boundary independently, so three changes in a row came out as three ramps
 * with flat treads between them -- a staircase. David asked for a system that
 * "calculates the steps from each other", looking ahead to see how many cells
 * until the next change and producing one continuous hill across all of them.
 *
 * That is what a BLUR of the level field does, and it is why this is a blur
 * rather than hand-written lookahead:
 *
 *   · a blurred step function is a smooth S-curve spanning the kernel, so a
 *     single isolated change becomes a gentle slope
 *   · a blur of a CONSTANT is that constant, so plateau interiors stay dead
 *     flat with no special case
 *   · overlapping transitions SUM, so a staircase merges into one long ramp
 *     automatically -- the lookahead is emergent, not coded
 *
 * CLIFFS ARE BARRIERS. A sample is only accumulated if its level is within
 * CLIFF_LEVELS of the corner's home level. So a cliff-top corner never averages
 * in the ground below it: the plateau stays flat right up to the lip and the kit
 * piece still sits correctly. Without this the blur would round every cliff into
 * a slope and the 44-piece cliff kit would have nothing to draw.
 *
 * Corners, not centres, because a quad with four independent corner heights is
 * already a continuous surface -- no subdivision needed, so this costs the same
 * geometry the stepped version did.
 */
export function heightField(map: IslandMap, spread = SLOPE_SPREAD): Float32Array {
  const W = map.width + 1;
  const D = map.depth + 1;
  const out = new Float32Array(W * D);

  // Transition width of a blurred step is about 3 sigma, so solve for sigma.
  const sigma = Math.max(0.5, spread / 3);
  const radius = Math.ceil(sigma * 3);
  const inv2s2 = 1 / (2 * sigma * sigma);

  // Level of the cell nearest a corner, clamped into the map. Corners sit at
  // cell boundaries, so the cell up-left of the corner is the natural home.
  const homeLevel = (ix: number, iz: number) =>
    levelAt(map, Math.min(map.width - 1, Math.max(0, ix - 1)), Math.min(map.depth - 1, Math.max(0, iz - 1)));

  for (let iz = 0; iz < D; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const home = homeLevel(ix, iz);
      let sum = 0;
      let wsum = 0;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = ix - 1 + dx;
          const cz = iz - 1 + dz;
          if (!inBounds(map, cx, cz)) continue;
          const l = levelAt(map, cx, cz);
          // The cliff barrier. Anything a full cliff away is a different
          // terrace and must not bleed across.
          if (Math.abs(l - home) >= CLIFF_LEVELS) continue;
          const w = Math.exp(-(dx * dx + dz * dz) * inv2s2);
          sum += l * w;
          wsum += w;
        }
      }
      out[iz * W + ix] = (wsum > 0 ? sum / wsum : home) * LEVEL_STEP;
    }
  }

  /**
   * PIN CLIFF TOPS, and this pass is not optional.
   *
   * A kit piece sits on a cliff cell and expects its top to be flat at exactly
   * level * LEVEL_STEP. Inferring that from the blur does not work: `home` above
   * is taken from ONE adjacent cell, so a corner on a cliff boundary can anchor
   * to the LOW side, which then excludes the cliff above it as out-of-range and
   * reads as ground level. Measured before this pass, 75 of 133 cliff cells
   * drifted, median 0.742u -- a whole level -- so every piece would have floated
   * or sunk by its own height.
   *
   * Both passes are needed. The blur handles walkable ground; this makes the
   * cliffs exact.
   *
   * MAX where two cliff cells of different levels share a corner: at a lip the
   * higher terrace wins, or the upper piece would hang over a gap.
   */
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (!needsCliff(map, cx, cz)) continue;
      const top = levelAt(map, cx, cz) * LEVEL_STEP;
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const i = (cz + oz) * W + (cx + ox);
        if (top > out[i]) out[i] = top;
      }
    }
  }
  return out;
}

/**
 * Ground height on a ramp cell at a world position, interpolated across it.
 *
 * The cell is stored at the lower level; the surface climbs one full LEVEL_STEP
 * across the tile in `rampDir`. Returns null when this is not a ramp so callers
 * can fall through to the flat case.
 */
export function rampHeightAt(map: IslandMap, x: number, z: number): number | null {
  const cx = worldToCellX(map, x);
  const cz = worldToCellZ(map, z);
  const run = rampRun(map, cx, cz);
  if (!run) return null;
  const [dx, dz] = run.dir;
  // How far across THIS tile we are, measured along the climb: 0 at its low
  // edge, 1 at its high edge.
  const ox = x - cellToWorldX(map, cx);
  const oz = z - cellToWorldZ(map, cz);
  const along = Math.min(1, Math.max(0, (dx !== 0 ? ox * dx : oz * dz) / TILE + 0.5));
  // Then where that lands along the WHOLE run, which is what makes a two-tile
  // ramp a continuous slope instead of two steps.
  const t = (run.index + along) / run.length;
  return (run.base + t * run.rise) * LEVEL_STEP;
}

/**
 * The height range a cell's own surface is allowed to occupy.
 *
 * WHY THIS IS NEEDED, and it is not a detail. The field stores one height per
 * cell CORNER, but a corner on a cliff boundary belongs to two cells that must
 * disagree: the cliff top wants 1.5u and the ground below wants 0. A single
 * value cannot be both, and the cliff-pinning pass resolves it in the cliff's
 * favour -- which then drags the LOW cell's edge halfway up the wall when it
 * samples that corner. Measured before this: a level-0 cell one cell from a full
 * drop read 0.75, exactly half the cliff.
 *
 * The mesh does not actually share vertices -- every cell pushes its own four --
 * so each cell may clamp the field to what IT can legitimately reach. That range
 * is its own level plus any neighbour a blend is allowed to cross, which is the
 * same barrier the blur itself uses. A full drop is excluded, so a cell beside a
 * cliff stays flat and the wall stays vertical.
 */
export function cellHeightRange(map: IslandMap, cx: number, cz: number): [number, number] | null {
  const here = levelAt(map, cx, cz);
  let cliffNear = false;
  let lo = here;
  let hi = here;
  for (const [dx, dz] of DIR_OFFSETS) {
    const nx = cx + dx;
    const nz = cz + dz;
    if (!inBounds(map, nx, nz) || isVoid(surfaceAt(map, nx, nz))) continue;
    const l = levelAt(map, nx, nz);
    if (Math.abs(l - here) >= CLIFF_LEVELS) {
      cliffNear = true;
      continue; // a cliff, not a blend
    }
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  // NULL means "use the field raw". Clamping a cell that has no cliff near it
  // makes it disagree with its neighbours, and two adjacent cells clamped to
  // different ranges leave a CRACK in the surface -- measured at 0.23u across a
  // blend, which is a third of a level and plainly visible. The clamp exists
  // only to stop a pinned cliff corner dragging the ground beside it up, so it
  // should apply only where a cliff is actually adjacent.
  if (!cliffNear) return null;
  return [lo * LEVEL_STEP, hi * LEVEL_STEP];
}

/** Bilinear sample of a corner height field at a world position. */
export function sampleHeightField(map: IslandMap, field: Float32Array, x: number, z: number): number {
  const W = map.width + 1;
  // Corner (0,0) sits half a tile up-left of cell (0,0)'s centre.
  const fx = Math.min(map.width, Math.max(0, (x - map.originX) / TILE + 0.5));
  const fz = Math.min(map.depth, Math.max(0, (z - map.originZ) / TILE + 0.5));
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(map.width, x0 + 1);
  const z1 = Math.min(map.depth, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const a = field[z0 * W + x0];
  const b = field[z0 * W + x1];
  const c = field[z1 * W + x0];
  const d = field[z1 * W + x1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/**
 * Water edges: which orthogonal neighbours of a LAND cell are river.
 *
 * The counterpart to `bankEdges`. A bank is a walkable step between two land
 * levels; this is the boundary between land and water, and it wants a hanging
 * grass card rather than a sloped skirt.
 *
 * Void is excluded deliberately. Where land meets open sea the beach already
 * runs down under the waterline, so a fringe there would float over nothing --
 * the same reason `bankEdges` skips it.
 */
export function waterEdges(map: IslandMap, cx: number, cz: number): [number, number][] {
  const here = surfaceAt(map, cx, cz);
  if (isVoid(here) || isRiver(here)) return [];
  const out: [number, number][] = [];
  for (const [dx, dz] of ORTHOGONAL) {
    if (isRiver(surfaceAt(map, cx + dx, cz + dz))) out.push([dx, dz]);
  }
  return out;
}

/** Cells per chunk edge. One ACNH acre, and the culling/merge unit. */
export const CHUNK = 16;

/**
 * Ground plus three cliff tiers, in HALF steps — so the reachable ceiling is
 * unchanged at 3 x 1.5u, it just takes twice as many levels to get there.
 */
export const MAX_LEVEL = 6;

// ── Surfaces ─────────────────────────────────────────────────────
// Values are stable — they are persisted in the map file. Append only.

export const Surface = {
  Grass: 0,
  Soil: 1,
  Stone: 2,
  Sand: 3,
  Wood: 4,
  Brick: 5,
  River: 6,
  /**
   * No ground here — open sea beyond the coastline. A map is a rectangle but
   * an island is not, so roughly half of a square map is water. Void cells
   * emit no quad at all, which is both correct and the cheapest thing to
   * render. Distinct from River, which is water WITH a bed inside the island.
   */
  Void: 7,
  /**
   * A RAMP: the only way to change level on foot now that every drop is a cliff.
   *
   * David, 2026-07-29: "half steps which are more like stairs and ramps than
   * anything". A ramp cell is stored at the LOWER of the two levels it joins and
   * its direction is derived -- the orthogonal neighbour exactly one level up.
   * Nothing is authored twice.
   *
   * Measured need, not a nice-to-have: with hard cliffs everywhere the island
   * broke into 7 disconnected regions and 2394 of 10833 walkable cells (22%)
   * became unreachable. Ramps are what make the terrain traversable at all.
   */
  Ramp: 8,
} as const;
export type SurfaceId = (typeof Surface)[keyof typeof Surface];

/** Road-kit material folder per surface, or null when it is not a road. */
export const SURFACE_ROAD_KIT: Record<SurfaceId, string | null> = {
  [Surface.Grass]: null,
  [Surface.Soil]: "",
  [Surface.Stone]: "stone-",
  [Surface.Sand]: "sand-",
  [Surface.Wood]: "wood-",
  [Surface.Brick]: "brick-",
  [Surface.River]: null,
  [Surface.Void]: null,
  // A ramp wears the surface it joins, not a road kit of its own.
  [Surface.Ramp]: null,
};

export function isRiver(s: number): boolean {
  return s === Surface.River;
}

export function isRamp(s: number): boolean {
  return s === Surface.Ramp;
}

/** A run of ramp cells, resolved from the ground at either end. */
export interface RampRun {
  /** Uphill, from foot to top. */
  dir: [number, number];
  /** This cell's place in the run, 0 at the foot. */
  index: number;
  /** How many ramp cells the run spans. */
  length: number;
  /** Levels climbed from the ground at the foot to the ground at the top. */
  rise: number;
  /** Level of the ground the run starts from. */
  base: number;
}

/**
 * Resolve the whole run a ramp cell belongs to.
 *
 * WHY A RUN AND NOT A CELL. A ramp used to be one cell climbing exactly one
 * level, which meant it could never get you up a cliff: a full cliff is
 * CLIFF_LEVELS and a one-cell ramp left you half a level short of the top. So
 * every cliff was a wall with no way over it. Terracing a test mountain made it
 * drawable and stranded 70 cells on the summit, which is the same bug wearing a
 * different hat.
 *
 * David, 2026-07-31: build the gentle one. A run climbs CLIFF_LEVELS over two
 * tiles, so 1.5u of rise across 2.0u of ground, about 37 degrees. The steep
 * one-tile version is 56 degrees and reads as a wall you happen to be able to
 * walk up.
 *
 * NOTHING IS AUTHORED TWICE. The run is derived: walk uphill through touching
 * ramp cells to the ground at the top, walk back down to the ground at the
 * foot, and the rise and length fall out. Painting two ramp cells against a
 * cliff is the whole authoring step. Returns null when the run joins nothing at
 * one end, which is an authoring mistake worth surfacing rather than silently
 * rendering flat.
 */
export function rampRun(map: IslandMap, cx: number, cz: number): RampRun | null {
  if (!isRamp(surfaceAt(map, cx, cz))) return null;
  for (const [dx, dz] of ORTHOGONAL) {
    // Uphill to the first cell that is not ramp.
    let ahead = 0;
    let tx = cx + dx;
    let tz = cz + dz;
    while (inBounds(map, tx, tz) && isRamp(surfaceAt(map, tx, tz))) {
      ahead++;
      tx += dx;
      tz += dz;
    }
    if (!inBounds(map, tx, tz)) continue;
    const topS = surfaceAt(map, tx, tz);
    if (isVoid(topS) || isRiver(topS)) continue;

    // Downhill to the first cell that is not ramp.
    let behind = 0;
    let bx = cx - dx;
    let bz = cz - dz;
    while (inBounds(map, bx, bz) && isRamp(surfaceAt(map, bx, bz))) {
      behind++;
      bx -= dx;
      bz -= dz;
    }
    if (!inBounds(map, bx, bz)) continue;
    const footS = surfaceAt(map, bx, bz);
    if (isVoid(footS) || isRiver(footS)) continue;

    const base = levelAt(map, bx, bz);
    const rise = levelAt(map, tx, tz) - base;
    // Downhill in this direction, or a climb taller than the kit can face.
    if (rise < 1 || rise > CLIFF_LEVELS) continue;
    return { dir: [dx, dz], index: behind, length: behind + ahead + 1, rise, base };
  }
  return null;
}

/**
 * Which way a ramp climbs, or null when it joins nothing.
 *
 * Kept as its own function because most callers only want the arrow.
 */
export function rampDir(map: IslandMap, cx: number, cz: number): [number, number] | null {
  return rampRun(map, cx, cz)?.dir ?? null;
}

/** True where the map has no ground at all — nothing to draw, nothing to walk. */
export function isVoid(s: number): boolean {
  return s === Surface.Void;
}

// ── Map ──────────────────────────────────────────────────────────

export interface IslandMap {
  /** Cells along +X. */
  width: number;
  /** Cells along +Z. */
  depth: number;
  /** World X of the CENTRE of cell (0, 0). */
  originX: number;
  /** World Z of the CENTRE of cell (0, 0). */
  originZ: number;
  /** Elevation level per cell, 0..MAX_LEVEL. Row-major, z-major. */
  levels: Uint8Array;
  /** Surface per cell. Row-major, z-major. */
  surfaces: Uint8Array;
}

export function createMap(width: number, depth: number, originX = 0, originZ = 0): IslandMap {
  return {
    width,
    depth,
    originX,
    originZ,
    levels: new Uint8Array(width * depth),
    surfaces: new Uint8Array(width * depth),
  };
}

/**
 * Centres a map on the world origin with cell CENTRES on integer coordinates.
 *
 * `-floor(n/2)` rather than `-(n-1)/2`: an even-sized map centred the naive
 * way puts every cell centre on a half-integer, and the existing world places
 * essentially everything on integers, so every single prop snapped exactly
 * sqrt(2)/2 away. Both parities now put a cell centre exactly on 0.
 */
export function createCenteredMap(width: number, depth: number): IslandMap {
  return createMap(width, depth, -Math.floor(width / 2) * TILE, -Math.floor(depth / 2) * TILE);
}

export function inBounds(map: IslandMap, cx: number, cz: number): boolean {
  return cx >= 0 && cz >= 0 && cx < map.width && cz < map.depth;
}

export function cellIndex(map: IslandMap, cx: number, cz: number): number {
  return cz * map.width + cx;
}

/** Level at a cell. Out of bounds reads as level 0 (the sea-level apron). */
export function levelAt(map: IslandMap, cx: number, cz: number): number {
  return inBounds(map, cx, cz) ? map.levels[cellIndex(map, cx, cz)] : 0;
}

/** Surface at a cell. Out of bounds reads as grass. */
export function surfaceAt(map: IslandMap, cx: number, cz: number): number {
  return inBounds(map, cx, cz) ? map.surfaces[cellIndex(map, cx, cz)] : Surface.Grass;
}

export function setCell(map: IslandMap, cx: number, cz: number, level: number, surface: number): void {
  if (!inBounds(map, cx, cz)) return;
  const i = cellIndex(map, cx, cz);
  map.levels[i] = Math.max(0, Math.min(MAX_LEVEL, level | 0));
  map.surfaces[i] = surface | 0;
}

/**
 * Walkable height at a cell. This replaces the entire FBM heightfield: an
 * array read and a multiply, with no noise, no bake and no interpolation.
 * River cells sit at their ground level; the water SURFACE is WATER_DROP
 * below that, which is the renderer's concern, not the collision height.
 */
export function heightAt(map: IslandMap, cx: number, cz: number): number {
  return levelAt(map, cx, cz) * LEVEL_STEP;
}

/** Water surface height for a river cell. */
export function waterHeightAt(map: IslandMap, cx: number, cz: number): number {
  return heightAt(map, cx, cz) - WATER_DROP;
}

// ── Serialised form ──────────────────────────────────────────────
// `data/island-map.json`: one row per line, one digit per cell. Compact
// enough to version, readable enough to review — a terrace edit shows up as a
// legible diff instead of an opaque blob.

export interface PlacedProp {
  kind: string;
  id?: string;
  cell: [number, number];
  level: number;
  /**
   * Footprint in cells, [width, depth], for things that occupy an area rather
   * than a point — a building plot, a plaza, a reserved block.
   *
   * `cell` stays the MINIMUM corner so a footprint is just cell + size, with no
   * even/odd rounding to get wrong. Absent means a point marker.
   *
   * ACNH buildings occupy whole tiles and the shipped GLBs already measure in
   * near-integer cells (`house-chalet.glb` is 5.00 x 4.21), so a footprint is
   * real map data the renderer will want, not only a drafting aid.
   */
  size?: [number, number];
}

/**
 * A named, hand-drawn region: fencing, a hedge line, "paved later", "keep clear".
 *
 * David, 2026-07-30: "custom things like fencing that I can label myself so that
 * there's more flexibility on the instructions given to you." That is the point
 * — an annotation is a message from the person drafting to whoever builds it,
 * and inventing a fixed vocabulary of surfaces would be the thing that limits
 * it. The name is free text and carries the meaning.
 *
 * Deliberately NOT a surface. Surfaces are a closed enum the renderer switches
 * on; adding drafting notes there would put made-up values into game data.
 * Annotations are sparse cell lists that the renderer ignores entirely.
 */
export interface MapAnnotation {
  name: string;
  /** CSS colour, so a draft reads the same in the editor as in a screenshot. */
  color: string;
  cells: [number, number][];
}

/**
 * The on-disk shape. `props[].cell` is typed loosely as `number[]` because
 * that is what a JSON import actually gives us — TypeScript cannot know a
 * parsed array has exactly two entries. Narrowing belongs here, in the parser
 * that owns validating external data, not at every call site via a cast.
 */
export interface IslandMapDoc {
  width: number;
  depth: number;
  originX: number;
  originZ: number;
  levels: string[];
  surfaces: string[];
  props?: { kind: string; id?: string; cell: number[]; level: number; size?: number[] }[];
  annotations?: { name: string; color?: string; cells: number[][] }[];
  /**
   * WRITTEN, NEVER READ. The engine's scale constants, stamped into the file so
   * anyone reading it knows what a level is worth.
   *
   * They are not per-map settings and the parser ignores them, but they cannot
   * be left stale either: a hand-drawn draft carried `levelStep: 1.5` forward
   * from an old export while the engine had moved to 0.75, so a mountain
   * authored as 9u tall was going to render at 4.5u and nothing said so.
   * Serialising the live constants keeps the file honest.
   */
  tile?: number;
  levelStep?: number;
}

export function parseIslandMap(doc: IslandMapDoc): {
  map: IslandMap;
  props: PlacedProp[];
  annotations: MapAnnotation[];
} {
  const map = createMap(doc.width, doc.depth, doc.originX, doc.originZ);
  for (let cz = 0; cz < doc.depth; cz++) {
    const lvlRow = doc.levels[cz] ?? "";
    const surfRow = doc.surfaces[cz] ?? "";
    for (let cx = 0; cx < doc.width; cx++) {
      const i = cz * doc.width + cx;
      map.levels[i] = Number(lvlRow[cx] ?? "0") || 0;
      map.surfaces[i] = Number(surfRow[cx] ?? "0") || 0;
    }
  }
  const props: PlacedProp[] = (doc.props ?? []).map((p) => ({
    kind: p.kind,
    ...(p.id ? { id: p.id } : {}),
    cell: [p.cell[0] ?? 0, p.cell[1] ?? 0],
    level: p.level ?? 0,
    // Narrowed here rather than at call sites: this is the parser, and it is the
    // only place that knows a JSON `number[]` is meant to be a pair. Anything
    // this function drops is lost on the next save, so a new field has to be
    // added here as well as to the type.
    ...(Array.isArray(p.size) && p.size.length === 2
      ? { size: [p.size[0], p.size[1]] as [number, number] }
      : {}),
  }));
  const annotations: MapAnnotation[] = (doc.annotations ?? []).map((a) => ({
    name: a.name,
    color: a.color ?? "#ffffff",
    cells: (a.cells ?? [])
      .filter((c) => Array.isArray(c) && c.length === 2)
      .map((c) => [c[0], c[1]] as [number, number]),
  }));
  return { map, props, annotations };
}

export function serialiseIslandMap(
  map: IslandMap,
  props: PlacedProp[] = [],
  annotations: MapAnnotation[] = []
): IslandMapDoc {
  const rows = (arr: Uint8Array) => {
    const out: string[] = [];
    for (let cz = 0; cz < map.depth; cz++) {
      let s = "";
      for (let cx = 0; cx < map.width; cx++) s += String(arr[cz * map.width + cx]);
      out.push(s);
    }
    return out;
  };
  return {
    width: map.width,
    depth: map.depth,
    originX: map.originX,
    originZ: map.originZ,
    tile: TILE,
    levelStep: LEVEL_STEP,
    levels: rows(map.levels),
    surfaces: rows(map.surfaces),
    props,
    // Omitted when empty so the shipped map does not carry a dead key, and so a
    // diff of a map with no annotations stays clean.
    ...(annotations.length ? { annotations } : {}),
  };
}

/**
 * Lower whatever is too tall to draw, until every face fits the kit.
 *
 * A cliff piece is ONE level-pair tall and does not stack, so a face steeper
 * than CLIFF_LEVELS has nothing to render it and comes out as a hole. Measured
 * on David's first hand-drawn island: the temple mountain rose 3 -> 6 in one
 * step, 20 undrawable faces in nine rows alone.
 *
 * This is the counterpart to drawing roughly. Blocking out a mountain by
 * sketching its silhouette is the right way to work; making every face legal by
 * hand is not, and it is exactly the kind of bookkeeping a tool should absorb.
 *
 * LOWERS rather than raises, matching `enforceSteps` in author-elevation.mjs:
 * raising would inflate a summit the author placed deliberately, while lowering
 * insets each tier and leaves the peak where it was drawn. Off-map and sea both
 * read as level 0, so a cliff at the coast stays legal — that is the rocks-at-
 * the-water silhouette, not a defect.
 *
 * Returns how many cells moved, so a caller can tell the difference between
 * "nothing to do" and "quietly rewrote your mountain".
 */
export function legaliseTerraces(map: IslandMap, maxPasses = 64): number {
  let moved = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = 0;
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        if (isVoid(surfaceAt(map, cx, cz))) continue;
        const i = cellIndex(map, cx, cz);
        const lvl = map.levels[i];
        if (lvl === 0) continue;
        let lowest = lvl;
        for (const [dx, dz] of DIR_OFFSETS) {
          const nx = cx + dx;
          const nz = cz + dz;
          const nl =
            inBounds(map, nx, nz) && !isVoid(surfaceAt(map, nx, nz))
              ? map.levels[cellIndex(map, nx, nz)]
              : 0;
          if (nl < lowest) lowest = nl;
        }
        if (lvl - lowest > CLIFF_LEVELS) {
          map.levels[i] = lowest + CLIFF_LEVELS;
          changed++;
        }
      }
    }
    moved += changed;
    if (!changed) break;
  }
  return moved;
}

/**
 * Copy a map into a square grid `size` cells a side, keeping it centred.
 *
 * THE INVARIANT: every surviving cell keeps the WORLD position it had. Cells
 * shift by half the size difference and the origin moves by the same amount the
 * other way, so growing the grid adds sea around the island rather than sliding
 * the island through it. Props move with their cells; anything pushed outside a
 * shrink is dropped.
 *
 * The `fill` is not a detail. `Surface.Grass` is 0, so the zeroed array behind a
 * new map is a solid grass square, not open water. Measured when this was first
 * written inline in `/lab/map`: growing 128 -> 160 turned 9216 cells of sea into
 * walkable land, and the editor reported 20670 land cells for an island with
 * 11454.
 */
export function resizeMap(
  map: IslandMap,
  props: PlacedProp[],
  size: number,
  annotations: MapAnnotation[] = []
): { map: IslandMap; props: PlacedProp[]; annotations: MapAnnotation[] } {
  const dst = createCenteredMap(size, size);
  dst.surfaces.fill(Surface.Void);
  const ox = Math.floor((size - map.width) / 2);
  const oz = Math.floor((size - map.depth) / 2);
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      const tx = cx + ox;
      const tz = cz + oz;
      if (tx < 0 || tz < 0 || tx >= size || tz >= size) continue;
      const si = cz * map.width + cx;
      const di = tz * size + tx;
      dst.levels[di] = map.levels[si];
      dst.surfaces[di] = map.surfaces[si];
    }
  }
  const moved = props
    .map((p) => ({ ...p, cell: [p.cell[0] + ox, p.cell[1] + oz] as [number, number] }))
    .filter((p) => p.cell[0] >= 0 && p.cell[1] >= 0 && p.cell[0] < size && p.cell[1] < size);
  // Annotations shift with everything else. An annotation that loses every cell
  // to a shrink is dropped rather than kept as an empty name.
  const shifted = annotations
    .map((a) => ({
      ...a,
      cells: a.cells
        .map((c) => [c[0] + ox, c[1] + oz] as [number, number])
        .filter((c) => c[0] >= 0 && c[1] >= 0 && c[0] < size && c[1] < size),
    }))
    .filter((a) => a.cells.length > 0);
  return { map: dst, props: moved, annotations: shifted };
}

// ── Cell <-> world ───────────────────────────────────────────────
// Cell (0,0)'s CENTRE sits at (originX, originZ); a cell spans +/- TILE/2.

export function cellToWorldX(map: IslandMap, cx: number): number {
  return map.originX + cx * TILE;
}

export function cellToWorldZ(map: IslandMap, cz: number): number {
  return map.originZ + cz * TILE;
}

export function worldToCellX(map: IslandMap, x: number): number {
  return Math.round((x - map.originX) / TILE);
}

export function worldToCellZ(map: IslandMap, z: number): number {
  return Math.round((z - map.originZ) / TILE);
}

/** Height under a world position. The per-frame ground-follow entry point. */
export function heightAtWorld(map: IslandMap, x: number, z: number): number {
  return heightAt(map, worldToCellX(map, x), worldToCellZ(map, z));
}

// ── Chunks ───────────────────────────────────────────────────────
// Chunking is what makes the world cullable. The old single 150x150 terrain
// plane was one geometry, so the GPU processed all of it regardless of where
// the camera looked, and ~48% of it lay outside the island entirely.

export interface ChunkRef {
  /** Chunk coordinates, not cells. */
  chunkX: number;
  chunkZ: number;
  /** Inclusive cell range covered. */
  minCellX: number;
  minCellZ: number;
  maxCellX: number;
  maxCellZ: number;
}

export function chunkCountX(map: IslandMap): number {
  return Math.ceil(map.width / CHUNK);
}

export function chunkCountZ(map: IslandMap): number {
  return Math.ceil(map.depth / CHUNK);
}

export function listChunks(map: IslandMap): ChunkRef[] {
  const out: ChunkRef[] = [];
  for (let chunkZ = 0; chunkZ < chunkCountZ(map); chunkZ++) {
    for (let chunkX = 0; chunkX < chunkCountX(map); chunkX++) {
      out.push({
        chunkX,
        chunkZ,
        minCellX: chunkX * CHUNK,
        minCellZ: chunkZ * CHUNK,
        maxCellX: Math.min((chunkX + 1) * CHUNK - 1, map.width - 1),
        maxCellZ: Math.min((chunkZ + 1) * CHUNK - 1, map.depth - 1),
      });
    }
  }
  return out;
}

// ── Autotile ─────────────────────────────────────────────────────
//
// One solver drives cliff, river and road, because all three kits share the
// `{Kit}{Class}{Variant}_{Rotation}` vocabulary (44 / 45 / 20 pieces).
//
// NEIGHBOUR BITS, clockwise from north, where north is -Z and east is +X:
//
//        NW  N  NE            7  0  1
//         W  ·  E     bits    6  ·  2
//        SW  S  SE            5  4  3
//
// A 90-degree clockwise rotation about Y maps N->E->S->W, which is a rotation
// of the mask by two bit positions. That is the whole trick: we normalise a
// mask to its smallest rotation, look the canonical form up once, and report
// how many quarter-turns it took to get there.
//
// BLOB RULE: a diagonal only counts when BOTH orthogonals flanking it are
// also set. A diagonal neighbour touching nothing else cannot change the
// silhouette, and folding those cases together is what collapses 256 raw
// masks down to the kit's piece count. This is the standard blob-tileset
// rule and it is what produces ACNH's rounded outer corners.

// A plain object rather than a TS enum: `const enum` cannot be type-stripped,
// so it breaks `node script.mjs` importing this module directly — which the
// M3 snap script does. Same shape as Surface above.
export const Dir = {
  N: 0,
  NE: 1,
  E: 2,
  SE: 3,
  S: 4,
  SW: 5,
  W: 6,
  NW: 7,
} as const;
export type DirId = (typeof Dir)[keyof typeof Dir];

/** Cell offsets per direction bit, in the order above. */
export const DIR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // N
  [1, -1], // NE
  [1, 0], // E
  [1, 1], // SE
  [0, 1], // S
  [-1, 1], // SW
  [-1, 0], // W
  [-1, -1], // NW
];

/** Rotate a neighbour mask by `quarters` clockwise 90-degree turns. */
export function rotateMask(mask: number, quarters: number): number {
  const s = ((quarters % 4) + 4) % 4;
  const shift = s * 2;
  return ((mask << shift) | (mask >>> (8 - shift))) & 0xff;
}

/**
 * Zero any diagonal bit whose two flanking orthogonals are not both set.
 * Applying this first is what makes the mask space finite and small.
 */
export function canonicaliseDiagonals(mask: number): number {
  let out = mask;
  for (let d = 1; d < 8; d += 2) {
    const before = (d + 7) % 8; // the orthogonal counter-clockwise of d
    const after = (d + 1) % 8; // the orthogonal clockwise of d
    const flanked = (mask & (1 << before)) !== 0 && (mask & (1 << after)) !== 0;
    if (!flanked) out &= ~(1 << d);
  }
  return out & 0xff;
}

export interface TileChoice {
  /**
   * Which of the 47 distinct neighbourhoods this is, 0..46, assigned in
   * ascending canonical-mask order. This is MATH and it is stable.
   */
  config: number;
  /** Quarter-turns clockwise about Y to apply, 0..3. */
  rotation: number;
  /** The rotation-normalised mask this resolved through. */
  canonicalMask: number;
  /** Set neighbours after the blob rule, 0..8. Useful for debugging. */
  degree: number;
}

/**
 * Rotation-normalise a mask: return the smallest value across the four
 * rotations, plus the number of quarter-turns needed to get from that
 * canonical orientation back to the input.
 */
export function normaliseMask(mask: number): { canonical: number; rotation: number } {
  const m = canonicaliseDiagonals(mask);
  let canonical = m;
  let rotation = 0;
  for (let q = 1; q < 4; q++) {
    const r = rotateMask(m, q);
    if (r < canonical) {
      canonical = r;
      // r === rotateMask(m, q) means applying (4 - q) turns to the canonical
      // form reproduces the input.
      rotation = (4 - q) % 4;
    }
  }
  return { canonical, rotation };
}

/**
 * Canonical masks in ascending order. Index = config id.
 *
 * The blob rule collapses all 256 raw masks into 15 ROTATION-CLASSES, which
 * expand to 47 distinct (config, rotation) tiles — the textbook 47-tile blob
 * set. Those two numbers are easy to confuse; the kit ships 16 base shapes and
 * 44 pieces, so both are close but neither is an exact match. Built lazily.
 */
let CONFIGS: number[] | null = null;
let CONFIG_OF_MASK: Map<number, number> | null = null;

function buildConfigs(): void {
  const set = new Set<number>();
  for (let mask = 0; mask < 256; mask++) set.add(normaliseMask(mask).canonical);
  CONFIGS = [...set].sort((a, b) => a - b);
  CONFIG_OF_MASK = new Map(CONFIGS.map((c, i) => [c, i]));
}

/** The 47 canonical neighbourhoods, ascending. */
export function listConfigs(): readonly number[] {
  if (!CONFIGS) buildConfigs();
  return CONFIGS!;
}

export function popcount8(mask: number): number {
  let n = 0;
  for (let i = 0; i < 8; i++) if (mask & (1 << i)) n++;
  return n;
}

/**
 * Resolve a neighbour mask to a canonical configuration plus a rotation.
 * Total over all 256 masks, and provably rotation-stable — see grid.test.ts.
 */
export function autotile(mask: number): TileChoice {
  if (!CONFIG_OF_MASK) buildConfigs();
  const { canonical, rotation } = normaliseMask(mask);
  return {
    config: CONFIG_OF_MASK!.get(canonical) ?? 0,
    rotation,
    canonicalMask: canonical,
    degree: popcount8(canonical),
  };
}

// ── Config -> kit piece ──────────────────────────────────────────
//
// DERIVED BY MEASUREMENT, not guessed and not eyeballed.
//
// A cliff piece carries rock wall EXACTLY where its neighbour is lower — that
// is what a cliff is — so the position of the `mCliff` geometry inside the
// 10x10 footprint encodes the neighbour mask directly. Wall on the north edge
// means the north neighbour is lower, which means that mask bit is clear.
// `scripts/derive-kit-mapping.mjs` reads it off every piece and prints this
// table; re-run it if the kit is ever re-extracted.
//
// That measurement also corrected a wrong assumption from M2. The trailing
// number in `2-b-0` is NOT a rotation — it is a VISUAL VARIANT. All four files
// in a family share the same wall centroid and extents, and a 90-degree
// rotation would move the centroid. ACNH varies the rock detail so a long
// cliff run does not look tiled, and the engine applies rotation itself. So
// the renderer picks a variant for flavour and applies `rotation` as a
// transform.
//
// Coverage: 14 of the 15 canonical configurations are answered by the cliff
// kit. Config 14 (fully enclosed, no wall anywhere) has no piece because it
// needs none — an interior cell is just ground.
export type KitName = "cliff" | "river" | "fall";

export interface KitPiece {
  /** `{class}-{variant}` filename stem. */
  stem: string;
  /** How many visual variants ship, i.e. `-0` .. `-(variants-1)`. */
  variants: number;
  /**
   * The rotation the FILE is already modelled at, in quarter-turns.
   *
   * A piece is not authored facing the canonical direction. `7-a` — the most
   * used piece on the map — sits at 3 quarter-turns from canonical. Placing
   * it at the solver's rotation without subtracting this put every wall on
   * the wrong side, which showed up in game as sky visible through the ground:
   * the exposed side was left open while a wall was built into the hillside.
   * Measured by scripts/derive-kit-mapping.mjs alongside the config.
   */
  baseRotation: number;
}

export const CONFIG_TO_PIECE: Record<KitName, Record<number, KitPiece>> = {
  cliff: {
    0: { stem: "0-a", variants: 1, baseRotation: 0 },
    1: { stem: "1-a", variants: 4, baseRotation: 2 },
    2: { stem: "2-c", variants: 4, baseRotation: 1 },
    3: { stem: "3-c", variants: 4, baseRotation: 1 },
    4: { stem: "2-a", variants: 2, baseRotation: 0 },
    5: { stem: "3-a", variants: 4, baseRotation: 0 },
    6: { stem: "4-b", variants: 4, baseRotation: 0 },
    7: { stem: "4-a", variants: 4, baseRotation: 0 },
    8: { stem: "5-b", variants: 4, baseRotation: 0 },
    9: { stem: "4-c", variants: 1, baseRotation: 0 },
    10: { stem: "2-b", variants: 4, baseRotation: 3 },
    11: { stem: "6-b", variants: 1, baseRotation: 3 },
    12: { stem: "3-b", variants: 4, baseRotation: 3 },
    13: { stem: "7-a", variants: 1, baseRotation: 3 },
  },
  // The river and fall kits share the vocabulary but their wall material and
  // conventions differ; derive them the same way when they get wired.
  river: {},
  fall: {},
};

/**
 * The variants of a family, in the order their UVs sit on the shared texture.
 *
 * MEASURED, and it corrects a wrong assumption. The four variants are not four
 * interchangeable rocks — they are four CONSECUTIVE QUARTERS of one 4-cell rock
 * strip. Every multi-variant family in the kit reports the same thing:
 *
 *     5-b-0  u 0.500..0.750     3-c-0  u 0.467..0.500
 *     5-b-3  u 0.750..1.000     3-c-3  u 0.500..0.750
 *     5-b-2  u 1.000..1.250     3-c-2  u 0.750..1.000
 *     5-b-1  u 1.250..1.500     3-c-1  u 1.000..1.250
 *
 * u-min steps by exactly 0.25 and the file order is 0,3,2,1 across all ten
 * families. So ACNH lays them in sequence ALONG a wall and a long run reads as
 * one continuous band of rock that repeats every 4 cells.
 *
 * Picking them with a per-cell hash — which is what this did — makes
 * neighbouring cells grab random quarters, so the rock pattern jumps
 * discontinuously at every cell boundary. That is what made a cliff face read
 * as a row of 1x1 blocks, and it is the same class of mistake as giving every
 * ground cell its own 0..1 UV.
 *
 * Re-derive with `scripts/derive-kit-mapping.mjs --variants` if the kit is
 * re-extracted.
 */
export const VARIANT_TEXTURE_ORDER = [0, 3, 2, 1] as const;

/**
 * Filename for a resolved config, or null when the kit needs no piece there
 * (an interior cell with no exposed side).
 *
 * `run` is the cell's position ALONG the wall, not a hash — see
 * VARIANT_TEXTURE_ORDER. The caller applies `choice.rotation` quarter-turns
 * about Y.
 */
export function pieceFileFor(kit: KitName, choice: TileChoice, run = 0): string | null {
  const piece = CONFIG_TO_PIECE[kit][choice.config];
  if (!piece) return null;
  const n = piece.variants;
  const variant = n > 1 ? VARIANT_TEXTURE_ORDER[(((run % n) + n) % n) % VARIANT_TEXTURE_ORDER.length] % n : 0;
  return `${piece.stem}-${variant}.glb`;
}

/**
 * Which cell axis runs ALONG a piece's wall, given the rotation applied to it.
 * Returns the coordinate to feed `pieceFileFor` as `run`.
 *
 * MEASURED, not derived. Reading the canonical masks says config 8 clears S,
 * SW and SE, which puts the wall on the south face and should make the run
 * east-west — so the first version of this returned `cx` at even rotations.
 * Checking it against the real map says the opposite, and not marginally:
 *
 *     axis cz : 271 / 278 adjacent same-config wall pairs continuous  (97%)
 *     axis cx :   7 / 278                                             ( 3%)
 *     old per-cell hash : 123 / 278                                   (44%)
 *
 * Somewhere between the bit order, `normaliseMask`'s rotation sign and the
 * renderer's `-rotation * 90` there is a half-turn this reasoning does not
 * capture. The measurement decides it. Re-run the check in
 * `scripts/derive-kit-mapping.mjs` if any of those three change.
 */
export function runAlongWall(rotation: number, cx: number, cz: number): number {
  return rotation % 2 === 0 ? cz : cx;
}

/**
 * Build a neighbour mask for a cell using an arbitrary "same region" test.
 * Cliffs pass a level comparison, rivers a surface comparison, roads a
 * material comparison — one solver, three questions.
 */
export function neighbourMask(
  map: IslandMap,
  cx: number,
  cz: number,
  same: (map: IslandMap, nx: number, nz: number) => boolean
): number {
  let mask = 0;
  for (let d = 0; d < 8; d++) {
    const [dx, dz] = DIR_OFFSETS[d];
    if (same(map, cx + dx, cz + dz)) mask |= 1 << d;
  }
  return mask;
}

// ── Leveling: bank vs cliff ──────────────────────────────────────
//
// One rule, applied everywhere: how far a neighbour sits BELOW a cell decides
// what goes between them.
//
//   drop of 0 levels                  nothing — flat ground
//   drop of 1 level  (0.75u)          a BANK. Walkable. A sloped grass skirt,
//                                     drawn by GridTerrain, no kit piece.
//   drop of CLIFF_LEVELS+ (1.5u+)     a CLIFF. Not walkable. A kit piece.
//
// Everything downstream — which cells the autotiler sees as "same", where the
// terrain mesh skips a quad, what the authoring script is allowed to build —
// reads these two predicates rather than comparing levels itself.

/** The four edge-sharing neighbours, in the order banks are emitted. */
export const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** How far the neighbour at (nx, nz) sits below this cell, in levels. */
export function dropTo(map: IslandMap, cx: number, cz: number, nx: number, nz: number): number {
  // A ramp is the way up, so from the high side it is not a drop at all. Without
  // this the plateau still wants a cliff piece on the ramp's face and the wall
  // is drawn straight across the thing you are supposed to walk up.
  if (isRamp(surfaceAt(map, nx, nz))) return 0;
  return levelAt(map, cx, cz) - levelAt(map, nx, nz);
}

/** Is the step down to this neighbour walkable, i.e. a bank rather than a cliff? */
export function isWalkableDrop(drop: number): boolean {
  // A one-level drop is BLENDED by `heightField` into a soft rise, so it IS
  // walkable. A full drop is a kit cliff and is not.
  return drop > 0 && drop < CLIFF_LEVELS;
}

/**
 * The rise a blended half step covers, world units. One level.
 *
 * David, 2026-07-30: "the half steps needs blending, and will be rarely used for
 * island naturalness, otherwise keep everything either flat or with 1 unit high
 * cliffs."
 *
 * So the island has exactly three states, and only one of them is a face:
 *
 *   flat                          the overwhelming majority
 *   2 levels  1.50u  FULL CLIFF   the kit piece, wherever ground does change
 *   1 level   0.75u  HALF STEP    BLENDED by heightField, rare, for naturalness
 *
 * A half step is deliberately NOT geometry. `heightField`'s blur crosses any
 * drop under CLIFF_LEVELS and treats a full drop as a barrier, so this falls out
 * of the field for free: soft where it should be soft, sharp where the kit
 * draws. An earlier pass built a vertical half-height face instead and drew it
 * into the same slope the field was already smoothing.
 */
export const HALF_STEP_RISE = LEVEL_STEP;

/**
 * Same TIER: the test that decides where a cliff face goes.
 *
 * Not "same or higher level" any more. A neighbour one level down is a bank you
 * step over, so as far as the cliff autotiler is concerned it is still the same
 * ground — only a drop of CLIFF_LEVELS or more opens a face. Getting this wrong
 * would put a cliff wall along every bank.
 */
export function sameLevelOrHigher(level: number) {
  return (map: IslandMap, nx: number, nz: number) =>
    // A ramp counts as the same tier for the autotile, which is what makes the
    // cliff outline turn a corner around the opening rather than sealing it.
    isRamp(surfaceAt(map, nx, nz)) || levelAt(map, nx, nz) > level - CLIFF_LEVELS;
}

/**
 * Does this cell need a cliff piece?
 *
 * True when any of the 8 neighbours sits CLIFF_LEVELS or more below — that
 * exposed side is what a cliff face IS. Void and off-map both read as level 0,
 * so a raised cell at the coastline is exposed and gets its face.
 *
 * GridTerrain skips these cells and GridCliffs draws them, because an ACNH
 * cliff piece carries its own grass top and a quad underneath would z-fight.
 */
export function needsCliff(map: IslandMap, cx: number, cz: number): boolean {
  const s = surfaceAt(map, cx, cz);
  if (isVoid(s)) return false;
  const level = levelAt(map, cx, cz);
  if (level < CLIFF_LEVELS) return false; // cannot be a full step above the sea
  for (const [dx, dz] of DIR_OFFSETS) {
    if (dropTo(map, cx, cz, cx + dx, cz + dz) >= CLIFF_LEVELS) return true;
  }
  return false;
}

/**
 * The orthogonal edges of this cell that fall a walkable step, as
 * `[dx, dz, drop]`. GridTerrain turns each into a sloped bank.
 *
 * Diagonals are left out on purpose: a bank is a skirt along an EDGE, and a
 * diagonal neighbour shares only a corner, which the two flanking edges already
 * cover between them.
 */
/**
 * Orthogonal edges that fall exactly ONE level: the half-cliff faces.
 *
 * The counterpart to `needsCliff`, which handles the two-level drops the kit
 * covers. A cell can have both -- a corner of a high plateau may drop two levels
 * on one side and one on another -- so these are drawn independently and the
 * autotile is never asked to represent a face it has no piece for.
 *
 * Void is skipped for the same reason it always was: where land meets open sea
 * the beach already runs under the waterline, and a face there would hang over
 * nothing.
 */
export function halfCliffEdges(map: IslandMap, cx: number, cz: number): [number, number][] {
  if (isVoid(surfaceAt(map, cx, cz))) return [];
  const out: [number, number][] = [];
  for (const [dx, dz] of ORTHOGONAL) {
    if (isVoid(surfaceAt(map, cx + dx, cz + dz))) continue;
    if (dropTo(map, cx, cz, cx + dx, cz + dz) === 1) out.push([dx, dz]);
  }
  return out;
}

/** @deprecated Nothing is walkable; use `halfCliffEdges`. Returns empty. */
export function bankEdges(_map: IslandMap, _cx: number, _cz: number): [number, number, number][] {
  return [];
}

/** The cliff piece for a cell, plus how to place it. Null when none is needed. */
export function cliffPieceFor(
  map: IslandMap,
  cx: number,
  cz: number
): { file: string; rotation: number; y: number } | null {
  if (!needsCliff(map, cx, cz)) return null;
  const level = levelAt(map, cx, cz);
  const mask = neighbourMask(map, cx, cz, sameLevelOrHigher(level));
  const choice = autotile(mask);
  const file = pieceFileFor("cliff", choice, runAlongWall(choice.rotation, cx, cz));
  if (!file) return null;
  // Subtract the rotation the file is already modelled at. Without this the
  // walls land on the wrong sides — see KitPiece.baseRotation.
  const base = CONFIG_TO_PIECE.cliff[choice.config]?.baseRotation ?? 0;
  const rotation = (((choice.rotation - base) % 4) + 4) % 4;
  // The piece's origin sits on its own TOP surface: Cliff0A_0 puts its top
  // grass at y=0 and drops the wall to y=-15 raw. So it mounts at the cell's
  // own walking height and hangs down toward whatever is below.
  return { file, rotation, y: level * LEVEL_STEP };
}

/** Same surface: the test roads and rivers tile against. */
export function sameSurface(surface: number) {
  return (map: IslandMap, nx: number, nz: number) => surfaceAt(map, nx, nz) === surface;
}

// ── Corner easing ────────────────────────────────────────────────
//
// WHY THIS EXISTS. David, 2026-07-27: "game looks like minecraft now, need you
// to have logic that eases land connections."
//
// Every boundary on a tile grid is made of axis-aligned cell edges, so a
// diagonal run comes out as a pixel staircase and every corner is a hard 90
// degrees. That is the Minecraft read, and it was worst at the coastline: a
// level-0 cell next to open sea gets no cliff piece, so the island silhouette
// was bare square quads and rendered as a 45-degree flight of stairs.
//
// ACNH never shows that edge because every one of its boundaries is drawn by an
// autotile whose corner pieces are ROUNDED. We do not have a fringe kit for
// grass-on-sand or for the shoreline, so we round the GEOMETRY instead: a cell
// on a boundary gets its convex corners cut by a quarter-circle.
//
// The useful property is that a full-tile cut turns a staircase into an exact
// straight diagonal. Take the blob { x >= z }: cell (1,1) spans [0.5,1.5]^2 and
// its NW corner is convex, so cutting it leaves the hypotenuse (0.5,0.5) ->
// (1.5,1.5); cell (2,2) contributes (1.5,1.5) -> (2.5,2.5); and cell (2,1)
// between them is interior and untouched. The segments meet exactly. Below a
// full tile the diagonal is scalloped rather than straight, which is the ACNH
// coastline look and why EASE_RADIUS is not 1.0.

/** How far into the cell a convex corner is cut, in tiles. */
export const EASE_RADIUS = 0.72;

/** Segments per rounded corner. 3 is smooth at our texel density; 1 is a bevel. */
export const EASE_SEGMENTS = 3;

/**
 * Corner traversal order, as (signX, signZ).
 *
 * Counter-clockwise in the XZ plane, which is what makes a centre-fan wind
 * +Y-up: for a triangle (centre, b, c) the normal's Y component is
 * `b.z * c.x - b.x * c.z`, and this order keeps it positive.
 */
const EASE_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];

/** Membership test for one draw layer: is this cell part of it? */
export type LayerTest = (cx: number, cz: number) => boolean;

/**
 * The cell's footprint as (x, z) offsets from its centre, in tiles.
 *
 * Returns null for a fully interior cell — the caller should emit a plain quad
 * and skip the fan, which keeps the extra triangles on the boundary where they
 * do something instead of on all 11k land cells.
 */
export function easedCellOutline(inLayer: LayerTest, cx: number, cz: number): number[][] | null {
  const half = TILE / 2;
  const r = EASE_RADIUS * TILE;

  // A corner is convex when both of the cells flanking it are outside the
  // layer. The diagonal must be outside too: when it is inside, the two cells
  // meet at a point, and cutting both corners would open a visible pinhole.
  const cut = EASE_CORNERS.map(
    ([sx, sz]) =>
      !inLayer(cx + sx, cz) && !inLayer(cx, cz + sz) && !inLayer(cx + sx, cz + sz)
  );
  if (!cut.some(Boolean)) return null;

  const out: number[][] = [];
  for (let i = 0; i < EASE_CORNERS.length; i++) {
    const [sx, sz] = EASE_CORNERS[i];
    if (!cut[i]) {
      out.push([sx * half, sz * half]);
      continue;
    }
    // Quarter-circle centred inside the cell, from the z-edge to the x-edge.
    const cxp = sx * (half - r);
    const czp = sz * (half - r);
    const arc: number[][] = [];
    for (let s = 0; s <= EASE_SEGMENTS; s++) {
      const th = (s / EASE_SEGMENTS) * (Math.PI / 2);
      arc.push([cxp + sx * r * Math.sin(th), czp + sz * r * Math.cos(th)]);
    }
    // The traversal enters diagonally-opposite corners from opposite edges, so
    // half of them walk the arc backwards. sx*sz picks which.
    if (sx * sz < 0) arc.reverse();
    out.push(...arc);
  }
  return out;
}

// ── Water depth ──────────────────────────────────────────────────

/**
 * Signed distance from the shoreline, in cells. Positive in water.
 *
 * WHY THIS EXISTS. The ACNH reference David gave is not a flat blue sheet: the
 * water is deep in the channel and lightens toward the bank, and that gradient
 * is most of what makes it read as WATER rather than as a painted surface. The
 * same number drives the white collar the reference puts around every rock and
 * every stretch of shore. We can compute it exactly rather than fake it in a
 * shader, because the map already knows where the banks are.
 *
 * WHY IT IS A TEXTURE AND NOT THE PER-CELL BFS IT REPLACES. The BFS produced
 * ONE INTEGER PER CELL, so every vertex of a cell carried the same value, the
 * attribute was constant across each quad, and anything keyed on it changed in
 * whole-cell steps. Under a soft gradient that was invisible; the moment the
 * foam became a hard edge (David, 2026-07-28) it drew the cell grid on screen
 * and the river came out as a stair-stepped white tube.
 *
 * Moving it to a vertex attribute sampled per corner fixes the staircase but
 * not the cause: the water mesh is one quad per cell, so the finest detail it
 * can carry is still one cell, and a curved bank facets along the triangle
 * diagonals. A FIELD SHOULD NOT INHERIT THE RESOLUTION OF THE MESH THAT READS
 * IT. So it goes in a texture, sampled per fragment, and the water mesh can
 * stay four vertices.
 *
 * SIGNED, because the field is sampled on both sides of the waterline and the
 * shader needs the crossing to land exactly on it: land carries the negative
 * distance INTO land, water the positive distance into water, and 0 is the
 * shore. A foam width of 0.85 then means 0.85 cells of real world.
 *
 * RASTERISED AT SUB-CELL RESOLUTION AGAINST THE EASED OUTLINE, not the cell
 * grid, because the eased outline is the shoreline you can actually see.
 *
 * This is also where props will earn their collar: stamping a footprint into
 * `land` before the transform gives it foam for free, with no per-object work
 * in the shader. Nothing does that yet — props are still in hardcoded arrays
 * rather than on the map.
 *
 * Void counts as water. Where a river meets the sea the mouth should shallow
 * out, not run deep to the edge of the world.
 */
export interface ShoreSdf {
  /** Signed distance from the waterline in CELLS, positive in water. */
  data: Float32Array;
  width: number;
  height: number;
  /** Samples per cell. */
  scale: number;
  /** World position of the field's lower-left corner. */
  minX: number;
  minZ: number;
  /** World extent covered. */
  sizeX: number;
  sizeZ: number;
}

/** Samples per cell. 4 puts the waterline within 12cm of where it is drawn. */
export const SHORE_SDF_SCALE = 4;

export function shoreSdf(map: IslandMap, scale = SHORE_SDF_SCALE): ShoreSdf {
  const width = map.width * scale;
  const height = map.depth * scale;

  const inGround: LayerTest = (cx, cz) =>
    inBounds(map, cx, cz) && !isVoid(surfaceAt(map, cx, cz)) && !isRiver(surfaceAt(map, cx, cz));

  // Rasterise the LAND, cell by cell, through the same outline the mesh uses.
  // Sampling the cell grid instead would put the field's shoreline on the
  // square boundary while the eye sees it on the eased one, and the foam would
  // sit a corner-radius away from the corner it belongs to.
  const land = new Uint8Array(width * height);
  const step = 1 / scale;
  const first = -0.5 + step / 2; // first sample centre, relative to the cell centre
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (!inGround(cx, cz)) continue;
      const outline = easedCellOutline(inGround, cx, cz);
      for (let sz = 0; sz < scale; sz++) {
        for (let sx = 0; sx < scale; sx++) {
          if (outline && !pointInPolygon(first + sx * step, first + sz * step, outline)) continue;
          land[(cz * scale + sz) * width + (cx * scale + sx)] = 1;
        }
      }
    }
  }

  return sdfFromMask(land, width, height, scale, {
    minX: map.originX - TILE / 2,
    minZ: map.originZ - TILE / 2,
    sizeX: map.width * TILE,
    sizeZ: map.depth * TILE,
  });
}

/**
 * Signed distance in CELLS from the edge of `mask`, positive where the mask is
 * 0 (water).
 *
 * Split out from `shoreSdf` so the tuning bench can bake its own bench-local
 * shore through the identical transform. The bench previously used an analytic
 * distance function, which is smooth by construction and therefore could not
 * show the stair-stepping the real field had — the tool hid the bug it existed
 * to catch.
 */
export function sdfFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  scale: number,
  rect: { minX: number; minZ: number; sizeX: number; sizeZ: number }
): ShoreSdf {
  const outward = squaredDistanceTransform(width, height, (i) => mask[i] === 1);
  const inward = squaredDistanceTransform(width, height, (i) => mask[i] === 0);

  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    // Sample centres sit half a sample from the boundary they share, so the
    // raw centre-to-centre distance overstates the reach to the waterline by
    // exactly that half. Divide through to land back in cells.
    const d = mask[i] ? -(Math.sqrt(inward[i]) - 0.5) : Math.sqrt(outward[i]) - 0.5;
    data[i] = d / scale;
  }
  return { data, width, height, scale, ...rect };
}

/** Even-odd crossing test. The outline is closed implicitly. */
function pointInPolygon(x: number, z: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Stand-in for infinity that survives the arithmetic in the 1-D pass. */
const DT_FAR = 1e9;

/**
 * Squared Euclidean distance from every sample to the nearest sample where
 * `isSeed` holds, as two 1-D passes (Felzenszwalb & Huttenlocher 2012).
 *
 * Exact, and O(n) — unlike a chamfer approximation it has no directional bias,
 * so the foam collar is the same width on a diagonal bank as on a straight one.
 */
function squaredDistanceTransform(
  width: number,
  height: number,
  isSeed: (i: number) => boolean
): Float64Array {
  const f = new Float64Array(width * height);
  for (let i = 0; i < f.length; i++) f[i] = isSeed(i) ? 0 : DT_FAR;

  const n = Math.max(width, height);
  const row = new Float64Array(n);
  const res = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = f[y * width + x];
    dt1d(row, width, res, v, z);
    for (let x = 0; x < width; x++) f[y * width + x] = res[x];
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) row[y] = f[y * width + x];
    dt1d(row, height, res, v, z);
    for (let y = 0; y < height; y++) f[y * width + x] = res[y];
  }
  return f;
}

/** Lower envelope of the parabolas rooted at each sample. Scratch is caller-owned. */
function dt1d(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -DT_FAR;
  z[1] = DT_FAR;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = DT_FAR;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Read the field at an arbitrary world position, bilinearly. For CPU callers. */
export function sampleShore(f: ShoreSdf, x: number, z: number): number {
  const fx = Math.min(f.width - 1, Math.max(0, ((x - f.minX) / f.sizeX) * f.width - 0.5));
  const fz = Math.min(f.height - 1, Math.max(0, ((z - f.minZ) / f.sizeZ) * f.height - 0.5));
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(f.width - 1, x0 + 1);
  const z1 = Math.min(f.height - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const a = f.data[z0 * f.width + x0];
  const b = f.data[z0 * f.width + x1];
  const c = f.data[z1 * f.width + x0];
  const d = f.data[z1 * f.width + x1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
