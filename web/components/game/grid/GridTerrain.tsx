"use client";

/**
 * GridTerrain (M4, 2026-07-26; corner easing 2026-07-27) — the ACNH ground plane.
 *
 * ACNH's entire ground is `FldUnit/Base_0.dae`: one 4-vertex 10x10 quad. This
 * builds the same thing, one cell at `level * 1.5`, merged per 16x16 acre.
 *
 * WHY CHUNKED. The old terrain was a single 150x150 PlaneGeometry — 93k
 * triangles the GPU processed no matter where the camera pointed, with ~48% of
 * it outside the island entirely. One geometry cannot be frustum-culled. An
 * acre can, and it is also ACNH's own authoring unit.
 *
 * TWO LAYERS, NOT SEVEN BUCKETS (2026-07-27). Every land cell draws grass; the
 * other surfaces draw ON TOP of it. That is ACNH's own model — `Base_0` is
 * grass everywhere and roads are autotiled decals over it — and here it is what
 * makes corner easing possible at all. Cutting a corner off a sand cell has to
 * reveal something, and in a one-layer world it revealed a hole.
 *
 * Cells that need a cliff piece are SKIPPED: an ACNH cliff piece carries its
 * own grass top, so a quad underneath would z-fight with it. GridCliffs draws
 * those.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  type IslandMap,
  Surface,
  TILE,
  LEVEL_STEP,
  CLIFF_LEVELS,
  WATER_DROP,
  LATTICE,
  OVERLAY_SURFACES,
  NATURAL_SURFACES,
  NATURAL_EDGE,
  DIR_OFFSETS,
  listChunks,
  levelAt,
  surfaceAt,
  isVoid,
  isWater,
  isRamp,
  rampRun,
  inBounds,
  cellToWorldX,
  cellToWorldZ,
  needsCliff,
  FRINGE_DROP,
  heightField,
  clampToCell,
  beachDropAt,
  shoreSdf,
  sampleShore,
  terrainOf,
  cellPieces,
  latticeAt,
  overlayAlpha,
  smoothstep,
  coastDistance,
  overlayAt,
  ROCK,
  WET,
  type ShoreSdf,
} from "@/lib/game/grid";
import { terrainMaterial, setShoreField } from "./terrainMaterials";
import { TUNING_DEFAULTS } from "@/lib/game/tuning";
import { bedDepth } from "@/lib/game/waterShader";

// Flat colours for the surfaces whose road-kit textures are not wired yet.
const SURFACE_COLOR: Record<number, string> = {
  [Surface.Grass]: "#8FA16C",
  [Surface.Soil]: "#BA9664",
  [Surface.Stone]: "#B0ACA6",
  [Surface.Sand]: "#E2CB93",
  [Surface.Wood]: "#A0784E",
  [Surface.Brick]: "#BA7A68",
  [Surface.River]: "#568CB2",
};

/**
 * Lift per overlay above the ground, in stacking order, so each wins the depth
 * test against what it covers without z-fighting: sand under soil under the
 * built surfaces, each built one above the last (a plaza meeting a boardwalk).
 */
const OVERLAY_LIFT: Record<number, number> = {
  [Surface.Sand]: 0.004,
  [Surface.Soil]: 0.008,
  [Surface.Stone]: 0.012,
  [Surface.Wood]: 0.014,
  [Surface.Brick]: 0.016,
};

/**
 * Render layer for the riverbed. Not a map Surface: nothing authors a bed cell,
 * it is derived from the water above it, the same way waterfalls are derived
 * from a level drop.
 */
const RIVER_BED = 8;

/** Render layer for the grass fringe that drapes over a water edge. */
const WATER_FRINGE = 9;

/**
 * Render layer for ramps.
 *
 * Given its own layer so it can wear a BUILT material rather than grass. A ramp
 * is the one piece of terrain that is an object you placed -- David, 2026-07-29:
 * "half steps which are more like stairs and ramps than anything" -- and a grass
 * slope reads as ground that happens to tilt, which is exactly the thing the
 * cliff model was meant to remove. Stone reads as an incline someone built.
 */
const RAMP_LAYER = 10;

/** Render layer for rock showing through steep ground (derived from slope, not painted). */
const ROCK_LAYER = 11;

/** The cliff kit's grass drape, in the island's grass colour. */
export const CLIFF_FRINGE = 12;


/**
 * How far the fringe card sits OUTBOARD of the land edge, in tiles.
 *
 * Slightly past the boundary so the blades overhang the water rather than
 * standing on the line. Small, because the drape is only 0.188u tall and a
 * bigger overhang reads as grass floating on the surface.
 */
const FRINGE_OVERHANG = 0.06;

// How many cells one repeat of a ground texture covers. PlaneGeometry's own
// 0..1 UVs put the WHOLE texture on every single cell, which turned the lawn
// into hard green/yellow stripes — an ACNH ground texture is a tiling pattern
// meant to run continuously across the terrain, not a per-tile decal.
const UV_CELLS_PER_REPEAT = 2;
const UV = 1 / (UV_CELLS_PER_REPEAT * TILE);

/** A layer's triangles, accumulated flat rather than as 11k BufferGeometries. */
interface Mesh {
  pos: number[];
  uv: number[];
  /** Explicit, from the height field's own slope, so hills light as hills. */
  nrm: number[];
  idx: number[];
  color: number[];
}

const emptyMesh = (): Mesh => ({ pos: [], uv: [], nrm: [], idx: [], color: [] });

type Height = (x: number, z: number) => number;


/** How far the bed drops below a grass bank's water at once: the river channel's edge. */
const BANK_DIP = 0.12;

/** How steep a height function is at a point, rise over run. */
function steepness(h: Height, x: number, z: number): number {
  const e = 0.05;
  return Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e);
}

/**
 * One vertex on a height function: world UVs so neighbouring cells continue
 * the pattern, and the normal from the surface's own slope (central
 * differences), so every cell that shares a point agrees on it and a hill
 * shades as one surface instead of as flat tiles. `color` is optional RGBA.
 */
function vertex(mesh: Mesh, h: Height, x: number, z: number, lift = 0, color?: readonly number[]) {
  const e = 0.05;
  const y = h(x, z), dx = (h(x + e, z) - h(x - e, z)) / (2 * e), dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
  const l = Math.hypot(dx, 1, dz);
  mesh.pos.push(x, y + lift, z);
  mesh.uv.push(x * UV, z * UV);
  mesh.nrm.push(-dx / l, 1 / l, -dz / l);
  if (color) mesh.color.push(...color);
}

/** Append convex polygons (world XZ, in `cellPieces` order) as fans facing +Y. */
function addPolygons(mesh: Mesh, polys: readonly number[][][], write: (x: number, z: number) => void) {
  for (const poly of polys) {
    const base = mesh.pos.length / 3;
    for (const [x, z] of poly) write(x, z);
    for (let i = 1; i < poly.length - 1; i++) mesh.idx.push(base, base + i + 1, base + i);
  }
}

/** A cell as polygons: one square, or LATTICE x LATTICE squares when its ground curves. */
function cellSquares(map: IslandMap, cx: number, cz: number, subdiv: number): number[][][] {
  const x0 = cellToWorldX(map, cx) - TILE / 2, z0 = cellToWorldZ(map, cz) - TILE / 2, step = TILE / subdiv, out: number[][][] = [];
  for (let j = 0; j < subdiv; j++) for (let i = 0; i < subdiv; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    out.push([[x, z], [x + step, z], [x + step, z + step], [x, z + step]]);
  }
  return out;
}

/**
 * Append the grass drape along one stretch of shoreline (a, b).
 *
 * ACNH hangs a strip of alpha-cut grass over every water boundary, and it is
 * what makes the edge read as an edge rather than as the place the ground ran
 * out. The card is vertical, FRINGE_DROP tall, hangs from the ground's own
 * height and sits FRINGE_OVERHANG outboard, so it reaches past the water surface
 * (only 0.078u below) and dips in. It follows the organic coast segment by
 * segment, so it bends with the shore instead of running along cell edges.
 *
 * U runs along WORLD position on the segment's main axis, so neighbouring
 * cards continue the same blades. The source texture is a 32:1 strip, so one
 * tile takes a 1/6 slice to keep the blades at roughly their authored shape.
 */
function addFringe(mesh: Mesh, h: Height, a: number[], b: number[], out: [number, number]) {
  const [ox, oz] = [out[0] * FRINGE_OVERHANG, out[1] * FRINGE_OVERHANG];
  const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
  const ta = h(a[0], a[1]), tb = h(b[0], b[1]);
  const pts: [number, number, number, number][] = [
    [a[0] + ox, ta, a[1] + oz, 0],
    [b[0] + ox, tb, b[1] + oz, 0],
    [b[0] + ox, tb - FRINGE_DROP, b[1] + oz, 1],
    [a[0] + ox, ta - FRINGE_DROP, a[1] + oz, 1],
  ];
  const base = mesh.pos.length / 3;
  for (const [x, y, z, v] of pts) {
    mesh.pos.push(x, y, z);
    mesh.uv.push((along ? z : x) / 6, v);
    // Face outward over the water, tipped up so it catches the key light like the ground it hangs from.
    mesh.nrm.push(out[0], 0.35, out[1]);
  }
  mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * The shoreline inside one lattice sub-square of a cell: where the coast field
 * crosses its edges, as one segment (the common case; a saddle is skipped).
 */
function shoreSegments(map: IslandMap, coast: Float32Array, cx: number, cz: number): number[][][] {
  const S = LATTICE, LW = map.width * S + 1, x0 = map.originX - 0.5, z0 = map.originZ - 0.5, out: number[][][] = [];
  for (let sk = 0; sk < S; sk++) for (let si = 0; si < S; si++) {
    const i = cx * S + si, k = cz * S + sk, p = k * LW + i;
    const c = [[0, 0, coast[p]], [1, 0, coast[p + 1]], [1, 1, coast[p + LW + 1]], [0, 1, coast[p + LW]]];
    const hits: number[][] = [];
    for (let e = 0; e < 4; e++) {
      const [au, av, va] = c[e], [bu, bv, vb] = c[(e + 1) % 4];
      if (va > 0 === vb > 0) continue;
      const t = va / (va - vb);
      hits.push([x0 + (i + au + (bu - au) * t) / S, z0 + (k + av + (bv - av) * t) / S]);
    }
    if (hits.length === 2) out.push(hits);
  }
  return out;
}

/**
 * One tile's slice of a ramp run.
 *
 * The only way to change level on foot across a cliff. Stored at the LOWER
 * level, so the low edge sits flush with the ground it leaves and the high edge
 * meets the plateau it joins. Takes both heights rather than deriving the top
 * from LEVEL_STEP: a run spans CLIFF_LEVELS across however many tiles it is
 * long, so each tile carries a fraction of the rise.
 *
 * The cliff outline routes AROUND this cell rather than sealing it, because
 * `sameLevelOrHigher` reports a ramp as the same tier and `dropTo` reports it as
 * no drop. Both live in grid.ts so the geometry and the autotile cannot disagree.
 */
function addRamp(
  mesh: Mesh,
  x: number,
  z: number,
  lowY: number,
  highY: number,
  dx: number,
  dz: number
) {
  const half = TILE / 2;
  // Across-slope axis is the perpendicular of the climb.
  const ax = dz;
  const az = dx;
  // Low edge is on the far side from the climb direction.
  const lx = x - dx * half;
  const lz = z - dz * half;
  const hx = x + dx * half;
  const hz = z + dz * half;

  // Normal tilts by THIS tile's rise, so a gentle run shades gently.
  const rise = highY - lowY;
  const len = Math.hypot(rise, TILE) || 1;
  const nx = (-dx * rise) / len;
  const ny = TILE / len;
  const nz = (-dz * rise) / len;

  const base = mesh.pos.length / 3;
  const pts: [number, number, number][] = [
    [lx - ax * half, lowY, lz - az * half],
    [lx + ax * half, lowY, lz + az * half],
    [hx + ax * half, highY, hz + az * half],
    [hx - ax * half, highY, hz - az * half],
  ];
  for (const [px, py, pz] of pts) {
    mesh.pos.push(px, py, pz);
    mesh.uv.push(px * UV, pz * UV);
    mesh.nrm.push(nx, ny, nz);
  }
  // Wind from the cross product against the known normal: keying on the sign of
  // the direction instead gets two of the four orientations backfacing, which
  // culls them into a hole.
  const [a, b, c] = pts;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const facing = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
  if (facing > 0) mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else mesh.idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
}

function build(mesh: Mesh): THREE.BufferGeometry | null {
  if (mesh.idx.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(mesh.pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.nrm, 3));
  if (mesh.color.length) g.setAttribute("color", new THREE.Float32BufferAttribute(mesh.color, 4));
  g.setIndex(mesh.idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Every chunk's geometry, per render layer. Pure (no React), so the budget and
 * tests can measure exactly what the game draws.
 *
 * THE GROUND IS CLIPPED TO THE COAST. A cell the shoreline crosses is cut into
 * its lattice sub-squares, each clipped against the coast field (`cellPieces`),
 * so the land ends on the organic contour the walker and the shore field use,
 * not on the painted squares. A cell inside the coast is one quad, or a
 * LATTICE x LATTICE grid where its ground curves (a slope, the beach).
 *
 * OVERLAYS FOLLOW THEIR OWN FIELDS. Sand and soil fade into the grass with a
 * worn edge (per-vertex alpha from their field, `overlayAlpha`); stone, wood and
 * brick are clipped to their field's 0-crossing, a crisp border with rounded
 * corners. Each sits OVERLAY_LIFT above the ground on the same height function.
 */
export function terrainChunks(map: IslandMap, heights: Float32Array | null, shore: ShoreSdf = shoreSdf(map)): { key: string; surface: number; geometry: THREE.BufferGeometry }[] {
  const out: { key: string; surface: number; geometry: THREE.BufferGeometry }[] = [];
  const terrain = terrainOf(map);
  const { coast } = terrain;
  const S = LATTICE, LW = map.width * S + 1;

  // How far the bed drops below the surface at a given point. Reads the
  // SHIPPED tuning, not the live bench value: this is geometry, and rebuilding
  // 128x128 cells of it on every slider frame would stall the tab. Moving
  // `bedDepth` or `bedSlope` on the bench changes the colour instantly and the
  // bed shape on reload.
  const water = TUNING_DEFAULTS.water;
  /**
   * The bed under a beach starts AT the waterline and carries the sand's slope on
   * down (a grass bank keeps its 0.12 channel edge). Near the coast the distance is
   * the coast field's own (smooth, so the sand and the bed meet without a step);
   * past a cell the shore field takes over.
   */
  const dipAt = (px: number, pz: number) => {
    const far = sampleShore(shore, px, pz), k = smoothstep(0.6, 1.2, far);
    const d = -coastDistance(map, px, pz) * (1 - k) + far * k;
    return Math.max(BANK_DIP * (1 - overlayAt(map, Surface.Sand, px, pz)), bedDepth(d, water));
  };

  /**
   * The ground a cell draws: the level field clamped to what this cell can
   * reach (a corner pinned to a cliff top must not drag the low ground beside it
   * up the wall, see `cellHeightRange`), less the beach.
   */
  const groundFor = (cx: number, cz: number): Height => (px, pz) =>
    (heights ? clampToCell(map, heights, cx, cz, px, pz) : levelAt(map, cx, cz) * LEVEL_STEP) - beachDropAt(map, px, pz);

  /** Does the ground curve inside this cell (a slope or the beach)? Then it gets the finer grid. */
  const curves = (h: Height, cx: number, cz: number) => {
    const x = cellToWorldX(map, cx), z = cellToWorldZ(map, cz), y = h(x, z);
    return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]].some(([a, b]) => Math.abs(h(x + a, z + b) - y) > 1e-3);
  };

  /** The extremes of a lattice field over one cell. */
  const cellMax = (f: Float32Array, cx: number, cz: number) => {
    let m = -Infinity;
    for (let k = cz * S; k <= cz * S + S; k++) for (let i = cx * S; i <= cx * S + S; i++) m = Math.max(m, f[k * LW + i]);
    return m;
  };
  const cellMin = (f: Float32Array, cx: number, cz: number) => {
    let m = Infinity;
    for (let k = cz * S; k <= cz * S + S; k++) for (let i = cx * S; i <= cx * S + S; i++) m = Math.min(m, f[k * LW + i]);
    return m;
  };

  /** Water surface for a cell the coast crosses: its own level, or the lowest water beside it. */
  const waterYFor = (cx: number, cz: number) => {
    if (isWater(surfaceAt(map, cx, cz))) return levelAt(map, cx, cz) * LEVEL_STEP - WATER_DROP;
    let lowest = Infinity;
    for (const [dx, dz] of DIR_OFFSETS) if (inBounds(map, cx + dx, cz + dz) && isWater(surfaceAt(map, cx + dx, cz + dz))) lowest = Math.min(lowest, levelAt(map, cx + dx, cz + dz));
    return (Number.isFinite(lowest) ? lowest : 0) * LEVEL_STEP - WATER_DROP;
  };

  for (const chunk of listChunks(map)) {
    const grass = emptyMesh();
    const river = emptyMesh();
    const bed = emptyMesh();
    const fringe = emptyMesh();
    const ramp = emptyMesh();
    const rock = emptyMesh();
    const overlays = new Map<number, Mesh>();

    for (let cz = chunk.minCellZ; cz <= chunk.maxCellZ; cz++) {
      for (let cx = chunk.minCellX; cx <= chunk.maxCellX; cx++) {
        const s = surfaceAt(map, cx, cz);
        if (isVoid(s)) continue; // legacy open sea: nothing to draw
        if (needsCliff(map, cx, cz)) continue; // the cliff piece brings its own top
        const x = cellToWorldX(map, cx);
        const z = cellToWorldZ(map, cz);

        // A ramp replaces its own ground: the sloped surface IS the cell.
        if (isRamp(s)) {
          const run = rampRun(map, cx, cz);
          if (run) {
            // This tile's slice of the run, so a two-tile ramp is one
            // continuous slope rather than two separate one-level ramps.
            const lowY = (run.base + (run.index / run.length) * run.rise) * LEVEL_STEP;
            const highY = (run.base + ((run.index + 1) / run.length) * run.rise) * LEVEL_STEP;
            addRamp(ramp, x, z, lowY, highY, run.dir[0], run.dir[1]);
            continue;
          }
        }

        const h = groundFor(cx, cz);
        const land = cellPieces(map, cx, cz, [[coast, 1]]);

        // Water wherever the coast crosses the cell or the beach runs down to it, so the
        // swell can wash up the sand. The bed is clipped to the water side.
        if (land !== "full" || cellMin(coast, cx, cz) < 0.2) {
          const waterY = waterYFor(cx, cz);
          addPolygons(river, cellSquares(map, cx, cz, 1), (px, pz) => vertex(river, () => waterY, px, pz));
          const wet = cellPieces(map, cx, cz, [[coast, -1]]);
          // The bed under it, sloping away from the bank. David approved
          // bathymetry 2026-07-29: the reference colour ramp ends in the
          // SEABED colour, so there has to be a seabed and it has to get
          // further away as the water deepens, or the ramp has nothing to
          // ramp over. Depth comes from `bedDepth`, the same function the
          // shader mirrors in GLSL.
          const bedH: Height = (px, pz) => waterY - dipAt(px, pz);
          addPolygons(bed, wet === "full" ? cellSquares(map, cx, cz, 1) : wet, (px, pz) => vertex(bed, bedH, px, pz));
        }
        if (land !== "full" && !land.length) continue;

        const pieces = land === "full" ? cellSquares(map, cx, cz, curves(h, cx, cz) ? S : 1) : land;
        addPolygons(grass, pieces, (px, pz) => vertex(grass, h, px, pz));

        // Rock shows through where the ground is steep: a slope class read off the height field itself.
        if (pieces.length > 1 && [[0, 0], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].some(([a, b]) => steepness(h, x + a, z + b) > ROCK.from)) {
          addPolygons(rock, pieces, (px, pz) => vertex(rock, h, px, pz, 0.002, [1, 1, 1, smoothstep(ROCK.from, ROCK.to, steepness(h, px, pz))]));
        }

        for (const surface of OVERLAY_SURFACES) {
          const f = terrain.overlays.get(surface);
          if (!f) continue;
          const natural = NATURAL_SURFACES.has(surface);
          const reach = cellMax(f, cx, cz);
          if (reach <= (natural ? -NATURAL_EDGE : 0)) continue;
          const m = overlays.get(surface) ?? emptyMesh();
          overlays.set(surface, m);
          const lift = OVERLAY_LIFT[surface];
          if (natural) {
            // Sand darkens where the waves reach it: the wet band (WET), up from the waterline.
            const wet = surface === Surface.Sand ? (px: number, pz: number) => 1 - WET.dark * (1 - smoothstep(WET.hold, WET.run, coastDistance(map, px, pz))) : () => 1;
            addPolygons(m, pieces, (px, pz) => { const w = wet(px, pz); vertex(m, h, px, pz, lift, [w, w * 0.97, w * 0.92, overlayAlpha(surface, latticeAt(map, f, px, pz))]); });
          } else {
            const built = cellPieces(map, cx, cz, [[coast, 1], [f, 1]]);
            addPolygons(m, built === "full" ? pieces : built, (px, pz) => vertex(m, h, px, pz, lift));
          }
        }

        // Grass hanging over the water's edge, along the organic shoreline, wherever the
        // bank is grass (a beach runs into the water instead).
        if (land !== "full") {
          for (const [a, b] of shoreSegments(map, coast, cx, cz)) {
            const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
            if (OVERLAY_SURFACES.some((o) => { const f = terrain.overlays.get(o); return f && overlayAlpha(o, latticeAt(map, f, mx, mz)) > 0.5; })) continue;
            const e = 0.05, gx = latticeAt(map, coast, mx + e, mz) - latticeAt(map, coast, mx - e, mz), gz = latticeAt(map, coast, mx, mz + e) - latticeAt(map, coast, mx, mz - e);
            const l = Math.hypot(gx, gz) || 1;
            addFringe(fringe, h, a, b, [-gx / l, -gz / l]);
          }
        }
      }
    }

    const emit = (surface: number, mesh: Mesh) => {
      const g = build(mesh);
      if (g) out.push({ key: `${chunk.chunkX}:${chunk.chunkZ}:${surface}`, surface, geometry: g });
    };
    emit(Surface.Grass, grass);
    emit(RIVER_BED, bed);
    emit(Surface.River, river);
    emit(WATER_FRINGE, fringe);
    emit(RAMP_LAYER, ramp);
    emit(ROCK_LAYER, rock);
    for (const s of OVERLAY_SURFACES) {
      const m = overlays.get(s);
      if (m) emit(s, m);
    }
  }
  return out;
}

export type TerrainPalette = { grass: string; soil: string; sand: string };

/**
 * Winter snow cover on palette terrain (0..1), shared uniform so a daily
 * season blend does not rebuild materials. Grain (luminance only) is the
 * dump's own `mSandSnow_Alb` snow variant (FldUnit), on grass, paths and beach.
 */
export const TERRAIN_SNOW = { value: 0 };
/** Grass detail and hue variation from the look preset (x = texture contrast kept, y = patch hue); LookMaterials writes it. */
export const TERRAIN_GRASS = { value: new THREE.Vector2(0.38, 0) };
let snowGrain: THREE.Texture | null = null;
function getSnowGrain(): THREE.Texture {
  if (!snowGrain) {
    snowGrain = new THREE.TextureLoader().load("/assets/acnh/terrain/mSandSnow_Alb.png");
    snowGrain.wrapS = snowGrain.wrapT = THREE.RepeatWrapping;
    snowGrain.colorSpace = THREE.SRGBColorSpace;
  }
  return snowGrain;
}
/** Paths keep a little of their colour through the snow; grass is covered. */
function addSnow(shader: THREE.WebGLProgramParametersWithUniforms, cover: number) {
  shader.uniforms.uSnow = TERRAIN_SNOW;
  shader.uniforms.uSnowGrain = { value: getSnowGrain() };
  shader.fragmentShader = "uniform float uSnow;\nuniform sampler2D uSnowGrain;\n" + shader.fragmentShader.replace("#include <normal_fragment_begin>", `
    #ifdef USE_MAP
      // The dump's snow albedo is warm-tinted; keep only its grain and use ACNH's cool snow ground.
      float snowGrain = dot(texture2D(uSnowGrain, vMapUv * 1.3).rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 snow = vec3(0.9, 0.93, 0.97) * (0.86 + (snowGrain - 0.55) * 0.35);
      diffuseColor.rgb = mix(diffuseColor.rgb, snow, uSnow * ${cover.toFixed(2)});
    #endif
    #include <normal_fragment_begin>`);
}

/** Every terrain layer's material, keyed by surface or render layer. Shared by the ground and the cliff kit. */
export type TerrainMaterials = Map<number, THREE.Material>;

/**
 * The terrain's materials for a palette. GridWorld builds them once and hands
 * the same instances to the ground and to the cliff kit, so a cliff's top grass
 * and its drape are the island's grass, not a second green.
 */
export function useTerrainMaterials(palette?: TerrainPalette): TerrainMaterials {
  const materials = useMemo(() => {
    // Names, not files — terrainMaterial() decides whether a surface gets an
    // ACNH texture or a procedural one, because two of the ACNH files are not
    // what their names imply (mGrass_Grd is a colour ramp, mRiver_Alb is the
    // riverbed). See terrainMaterials.ts.
    const SHARED: Partial<Record<number, string>> = {
      [Surface.Grass]: "mGrass",
      [Surface.Sand]: "mSand",
      [Surface.River]: "mRiver",
      // The four that were flat hex constants. Four of seven surfaces had no
      // texture at all, which is most of why the grid world read as unfinished
      // beside the old mesh terrain.
      [Surface.Soil]: "mRoadSoil",
      [Surface.Stone]: "mRoadStone",
      [Surface.Wood]: "mRoadWood",
      [Surface.Brick]: "mRoadBrick",
      // The one ACNH file that IS what its name says: mRiverBed_Alb is the
      // sandy bed, mean RGB (164,107,63). It was extracted and then never
      // drawn, because until now there was no bed to draw it on.
      [RIVER_BED]: "mRiverBed",
      [WATER_FRINGE]: "mGrassRiverXlu",
      [RAMP_LAYER]: "mRoadStone",
      [CLIFF_FRINGE]: "mGrassCliffXlu",
    };
    const m = new Map<number, THREE.Material>();
    for (const s of [
      Surface.Grass,
      RIVER_BED,
      Surface.River,
      WATER_FRINGE,
      CLIFF_FRINGE,
      RAMP_LAYER,
      ...OVERLAY_SURFACES,
    ]) {
      const sharedName = SHARED[s];
      const shared = sharedName ? terrainMaterial(sharedName) : null;
      if (shared && palette && s === Surface.Stone) {
        // Island stone (plaza) keeps its shared look and gains winter snow cover.
        const stone = shared.clone() as THREE.MeshStandardMaterial;
        stone.onBeforeCompile = (shader, renderer) => { shared.onBeforeCompile(shader, renderer); addSnow(shader, 0.8); };
        stone.customProgramCacheKey = () => "island-stone-snow-v1";
        m.set(s, stone);
        continue;
      }
      if (shared && palette && (s === WATER_FRINGE || s === CLIFF_FRINGE)) {
        // The grass drapes take the island's grass colour, or they read as a different lawn hanging off it.
        const drape = shared.clone() as THREE.MeshStandardMaterial;
        drape.onBeforeCompile = shared.onBeforeCompile;
        drape.customProgramCacheKey = shared.customProgramCacheKey;
        drape.color.set(palette.grass);
        m.set(s, drape);
        continue;
      }
      if (shared) {
        if (s === Surface.Sand || s === Surface.Soil || palette && s === Surface.Grass) {
          const overlay = shared.clone() as THREE.MeshStandardMaterial;
          // Clone does not preserve material shader hooks (grass reconstructs normal Z).
          overlay.onBeforeCompile = shared.onBeforeCompile;
          overlay.customProgramCacheKey = shared.customProgramCacheKey;
          if (palette) {
            // World UVs already repeat every two units. Do not inherit the
            // legacy 10x grass repeat, which reduced blades to subpixel noise.
            if (overlay.map) {
              overlay.map = overlay.map.clone();
              overlay.map.repeat.setScalar(s === Surface.Grass ? 0.85 : s === Surface.Soil ? 0.4 : 0.65);
              overlay.map.magFilter = THREE.LinearFilter;
              overlay.map.anisotropy = 4;
              overlay.map.needsUpdate = true;
            }
            if (overlay.normalMap) {
              overlay.normalMap = overlay.normalMap.clone();
              overlay.normalMap.repeat.setScalar(s === Surface.Grass ? 0.8 : 1.4);
              overlay.normalMap.magFilter = THREE.LinearFilter;
              overlay.normalMap.needsUpdate = true;
            }
            if (s === Surface.Grass) overlay.normalScale.set(0.38, 0.38);
          }
          if (s !== Surface.Grass) {
            overlay.vertexColors = true;
            overlay.transparent = true;
            overlay.depthWrite = false;
          }
          if (palette) overlay.color.set(s === Surface.Grass ? palette.grass : s === Surface.Soil ? palette.soil : palette.sand);
          if (palette && s === Surface.Grass) {
            overlay.onBeforeCompile = (shader, renderer) => {
              shared.onBeforeCompile(shader, renderer);
              shader.uniforms.uGrassLook = TERRAIN_GRASS;
              shader.fragmentShader = "uniform vec2 uGrassLook;\n" + shader.fragmentShader.replace("#include <map_fragment>", `
                #include <map_fragment>
                #ifdef USE_MAP
                  // Broad (~12 unit) patches lean yellow-green or blue-green.
                  vec2 grassQ = vMapUv * 0.9;
                  float grassHue = sin(grassQ.x * 1.3 + sin(grassQ.y * 1.1) * 1.6) * sin(grassQ.y * 1.5 + sin(grassQ.x * 0.9) * 1.8);
                  vec3 grassShift = mix(vec3(1.0), grassHue > 0.0 ? vec3(1.08, 1.02, 0.82) : vec3(0.9, 1.0, 1.06), abs(grassHue) * uGrassLook.y);
                  diffuseColor.rgb = diffuse * mix(vec3(0.9, 0.96, 0.88), sampledDiffuseColor.rgb, uGrassLook.x) * grassShift;
                #endif
              `);
              addSnow(shader, 0.96);
              // The cliff kit's grass is instanced and carries its own UVs: give it the ground's world
              // UVs, so a plateau top is the same lawn as the ground around it.
              shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
                #ifdef USE_INSTANCING
                  vec2 worldUv = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xz * ${UV.toFixed(4)};
                  #ifdef USE_MAP
                    vMapUv = (mapTransform * vec3(worldUv, 1.0)).xy;
                  #endif
                  #ifdef USE_NORMALMAP
                    vNormalMapUv = (normalMapTransform * vec3(worldUv, 1.0)).xy;
                  #endif
                #endif`);
            };
            overlay.customProgramCacheKey = () => "island-grass-detail-v5";
          }
          if (palette && s === Surface.Soil) {
            // The supplied soil albedo contains broad bright marks. Keep its
            // authored detail without repeating high-contrast spots down the path.
            overlay.normalScale.set(0.18, 0.18);
            overlay.onBeforeCompile = (shader, renderer) => {
              shared.onBeforeCompile(shader, renderer);
              shader.uniforms.uSoilGrain = { value: (terrainMaterial("mSand") as THREE.MeshStandardMaterial).map };
              shader.fragmentShader = "uniform sampler2D uSoilGrain;\n" + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
                #include <map_fragment>
                #ifdef USE_MAP
                  vec3 crossedSoil = texture2D(map, vec2(-vMapUv.y, vMapUv.x) * 1.73 + 0.37).rgb;
                  vec3 soilDetail = mix(sampledDiffuseColor.rgb, crossedSoil, 0.45);
                  float grain = dot(texture2D(uSoilGrain, vMapUv * 3.5).rgb, vec3(0.2126, 0.7152, 0.0722));
                  diffuseColor.rgb = diffuse * mix(vec3(0.82), soilDetail, 0.18) * (0.8 + grain * 0.5);
                #endif
              `);
              addSnow(shader, 0.7);
            };
            overlay.customProgramCacheKey = () => "island-soil-detail-v3";
          }
          if (palette && s === Surface.Sand) {
            // Retain the supplied sand grain while reducing its baked orange cast.
            overlay.onBeforeCompile = (shader, renderer) => {
              shared.onBeforeCompile(shader, renderer);
              shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
                #include <map_fragment>
                #ifdef USE_MAP
                  float sandLuma = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                  diffuseColor.rgb = diffuse * (0.84 + (sandLuma - 0.4) * 0.32);
                #endif
              `);
              addSnow(shader, 0.85);
            };
            overlay.customProgramCacheKey = () => "island-sand-detail-v3";
          }
          m.set(s, overlay);
        } else m.set(s, shared);
        continue;
      }
      m.set(
        s,
        new THREE.MeshStandardMaterial({
          color: SURFACE_COLOR[s],
          roughness: 0.92,
          metalness: 0,
          // Overlays sit 4mm above the base. Without this the two coplanar-ish
          // layers flicker against each other at grazing angles.
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
    }
    // Steep ground shows bare stony earth through the grass, faded in by slope: the soil
    // surface with its grain, in a cool grey-brown. (The cliff kit's rock is strata for a
    // vertical wall, which on a slope reads as ploughed furrows.)
    const soil = m.get(Surface.Soil) as THREE.MeshStandardMaterial;
    const rock = soil.clone();
    rock.onBeforeCompile = soil.onBeforeCompile;
    rock.customProgramCacheKey = soil.customProgramCacheKey;
    rock.color.set(ROCK.color);
    m.set(ROCK_LAYER, rock);
    return m;
  }, [palette]);

  useEffect(() => () => {
    if (palette) for (const surface of [Surface.Grass, Surface.Soil, Surface.Sand]) {
      const material = materials.get(surface) as THREE.MeshStandardMaterial;
      material.map?.dispose();
      material.normalMap?.dispose();
    }
    materials.get(Surface.Sand)?.dispose();
    materials.get(Surface.Soil)?.dispose();
    if (palette) materials.get(Surface.Grass)?.dispose();
    if (palette) materials.get(Surface.Stone)?.dispose();
    if (palette) materials.get(WATER_FRINGE)?.dispose();
    if (palette) materials.get(CLIFF_FRINGE)?.dispose();
    materials.get(ROCK_LAYER)?.dispose();
  }, [materials, palette]);

  return materials;
}

/**
 * The ground's draw order: the see-through layers (rock, then sand, then soil) after the rest. Anything lying on the
 * ground that does not write depth (the snow prints, WeatherGround) draws after GROUND_TOP_ORDER, or a path paints over it.
 */
export function groundRenderOrder(surface: number): number {
  return surface === ROCK_LAYER ? 1 : surface === Surface.Sand ? 2 : surface === Surface.Soil ? GROUND_TOP_ORDER : 0;
}
export const GROUND_TOP_ORDER = 3;

export default function GridTerrain({ map, field: heights, materials }: { map: IslandMap; field?: Float32Array; materials: TerrainMaterials }) {
  // ONE field, read twice: the seabed geometry samples it on the CPU, the water
  // shader samples it on the GPU. Two bakes would be two shorelines.
  const field = useMemo(() => shoreSdf(map), [map]);

  /**
   * The continuous ground height. One field, read by the mesh here and by the
   * height provider in GridWorld, so the player walks on exactly the surface
   * that is drawn -- two separate calculations is how a character ends up
   * hovering over a hill.
   */
  const chunks = useMemo(
    // Guarded on the constant: at CLIFF_LEVELS 1 every level change is a cliff and the blur has nothing to cross.
    () => terrainChunks(map, CLIFF_LEVELS > 1 ? heights ?? heightField(map) : null, field),
    [map, heights, field]
  );

  // The water reads its distance to the shore from a baked field rather than
  // from anything on the mesh, so this is a one-shot upload, not geometry.
  useEffect(() => {
    setShoreField(field);
  }, [field]);

  useEffect(() => () => { chunks.forEach(({ geometry }) => geometry.dispose()); }, [chunks]);
  return (
    <group>
      {chunks.map((c) => (
        // Rock, then sand, then soil: where a path meets the beach the soil is always the one on top.
        <mesh key={c.key} geometry={c.geometry} material={materials.get(c.surface)} receiveShadow renderOrder={groundRenderOrder(c.surface)} />
      ))}
    </group>
  );
}
