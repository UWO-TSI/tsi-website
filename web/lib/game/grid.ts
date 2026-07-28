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

/** Cells per chunk edge. One ACNH acre, and the culling/merge unit. */
export const CHUNK = 16;

/**
 * Ground plus three cliff tiers, in HALF steps — so the reachable ceiling is
 * unchanged at 3 x 1.5u, it just takes twice as many levels to get there.
 */
export const MAX_LEVEL = 3 * CLIFF_LEVELS;

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
};

export function isRiver(s: number): boolean {
  return s === Surface.River;
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
  props?: { kind: string; id?: string; cell: number[]; level: number }[];
}

export function parseIslandMap(doc: IslandMapDoc): { map: IslandMap; props: PlacedProp[] } {
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
  }));
  return { map, props };
}

export function serialiseIslandMap(map: IslandMap, props: PlacedProp[] = []): IslandMapDoc {
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
    levels: rows(map.levels),
    surfaces: rows(map.surfaces),
    props,
  };
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
  return levelAt(map, cx, cz) - levelAt(map, nx, nz);
}

/** Is the step down to this neighbour walkable, i.e. a bank rather than a cliff? */
export function isWalkableDrop(drop: number): boolean {
  return drop > 0 && drop < CLIFF_LEVELS;
}

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
    levelAt(map, nx, nz) > level - CLIFF_LEVELS;
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
export function bankEdges(map: IslandMap, cx: number, cz: number): [number, number, number][] {
  if (isVoid(surfaceAt(map, cx, cz))) return [];
  const out: [number, number, number][] = [];
  for (const [dx, dz] of ORTHOGONAL) {
    // A bank needs ground on both sides. Where the neighbour is open sea the
    // beach already runs down to the waterline and a skirt would float.
    if (isVoid(surfaceAt(map, cx + dx, cz + dz))) continue;
    const drop = dropTo(map, cx, cz, cx + dx, cz + dz);
    if (isWalkableDrop(drop)) out.push([dx, dz, drop]);
  }
  return out;
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
 * Distance from every river cell to the nearest bank, in cells.
 *
 * WHY THIS EXISTS. The ACNH reference David gave is not a flat blue sheet: the
 * water is deep navy in the channel and lightens toward the bank, and that
 * gradient is most of what makes it read as WATER rather than as a painted
 * surface. Sampling the reference gives roughly #26415E in the middle and
 * #6F8496 at the edge — a big swing, and it tracks distance from the bank.
 *
 * We can compute that exactly rather than faking it in a shader, because the
 * map already knows where the banks are. One BFS at build time, baked into a
 * vertex attribute, zero runtime cost. A screen-space depth fade would be an
 * approximation of a fact we already have.
 *
 * Non-river cells read 0. Void counts as a bank: where a river meets the sea
 * the mouth should shallow out, not run deep to the edge of the world.
 */
export function shoreDistance(map: IslandMap): Float32Array {
  const d = new Float32Array(map.width * map.depth);
  const queue: number[] = [];
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      const i = cellIndex(map, cx, cz);
      if (!isRiver(map.surfaces[i])) continue;
      let bank = false;
      for (const [dx, dz] of DIR_OFFSETS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!inBounds(map, nx, nz) || !isRiver(surfaceAt(map, nx, nz))) {
          bank = true;
          break;
        }
      }
      if (bank) {
        d[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const cz = Math.floor(i / map.width);
    const cx = i % map.width;
    for (const [dx, dz] of DIR_OFFSETS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!inBounds(map, nx, nz)) continue;
      const n = cellIndex(map, nx, nz);
      if (!isRiver(map.surfaces[n]) || d[n] !== 0) continue;
      d[n] = d[i] + 1;
      queue.push(n);
    }
  }
  return d;
}
