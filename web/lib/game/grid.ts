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

/** One elevation step, world units. Raw 15.0. */
export const LEVEL_STEP = 1.5;

/** River surface below its own ground level, world units. Raw 0.78. */
export const WATER_DROP = 0.078;

/** Cells per chunk edge. One ACNH acre, and the culling/merge unit. */
export const CHUNK = 16;

/** Ground plus three cliff tiers; ACNH's top tier is unusable. */
export const MAX_LEVEL = 3;

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
}

export const CONFIG_TO_PIECE: Record<KitName, Record<number, KitPiece>> = {
  cliff: {
    0: { stem: "0-a", variants: 1 },
    1: { stem: "1-a", variants: 4 },
    2: { stem: "2-c", variants: 4 },
    3: { stem: "3-c", variants: 4 },
    4: { stem: "2-a", variants: 2 },
    5: { stem: "3-a", variants: 4 },
    6: { stem: "4-b", variants: 4 },
    7: { stem: "4-a", variants: 4 },
    8: { stem: "5-b", variants: 4 },
    9: { stem: "4-c", variants: 1 },
    10: { stem: "2-b", variants: 4 },
    11: { stem: "6-b", variants: 1 },
    12: { stem: "3-b", variants: 4 },
    13: { stem: "7-a", variants: 1 },
  },
  // The river and fall kits share the vocabulary but their wall material and
  // conventions differ; derive them the same way when they get wired.
  river: {},
  fall: {},
};

/**
 * Filename for a resolved config, or null when the kit needs no piece there
 * (an interior cell with no exposed side).
 *
 * `seed` picks the visual variant deterministically — pass something derived
 * from the cell so a given cell always looks the same, and neighbouring cells
 * differ. The caller applies `choice.rotation` quarter-turns about Y.
 */
export function pieceFileFor(kit: KitName, choice: TileChoice, seed = 0): string | null {
  const piece = CONFIG_TO_PIECE[kit][choice.config];
  if (!piece) return null;
  const variant = piece.variants > 1 ? Math.abs(seed) % piece.variants : 0;
  return `${piece.stem}-${variant}.glb`;
}

/** Stable per-cell seed, so variant choice does not shimmer between frames. */
export function cellSeed(cx: number, cz: number): number {
  const h = (cx * 73856093) ^ (cz * 19349663);
  return h < 0 ? -h : h;
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

/** Same-or-higher level: the test that decides where a cliff face goes. */
export function sameLevelOrHigher(level: number) {
  return (map: IslandMap, nx: number, nz: number) => levelAt(map, nx, nz) >= level;
}

/**
 * Does this cell need a cliff piece?
 *
 * True when any of the 8 neighbours sits lower — that exposed side is what a
 * cliff face IS. Void and off-map both read as level 0, so a raised cell at
 * the coastline is exposed and gets its face, which is exactly the "rocks at
 * the water" silhouette.
 *
 * GridTerrain skips these cells and GridCliffs draws them, because an ACNH
 * cliff piece carries its own grass top and a quad underneath would z-fight.
 */
export function needsCliff(map: IslandMap, cx: number, cz: number): boolean {
  const s = surfaceAt(map, cx, cz);
  if (isVoid(s)) return false;
  const level = levelAt(map, cx, cz);
  if (level === 0) return false; // nothing below sea level to expose
  for (const [dx, dz] of DIR_OFFSETS) {
    if (levelAt(map, cx + dx, cz + dz) < level) return true;
  }
  return false;
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
  const file = pieceFileFor("cliff", choice, cellSeed(cx, cz));
  if (!file) return null;
  // The piece's origin sits on its own TOP surface: Cliff0A_0 puts its top
  // grass at y=0 and drops the wall to y=-15 raw. So it mounts at the cell's
  // own walking height and hangs down toward whatever is below.
  return { file, rotation: choice.rotation, y: level * LEVEL_STEP };
}

/** Same surface: the test roads and rivers tile against. */
export function sameSurface(surface: number) {
  return (map: IslandMap, nx: number, nz: number) => surfaceAt(map, nx, nz) === surface;
}
