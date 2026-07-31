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
  listChunks,
  levelAt,
  surfaceAt,
  isVoid,
  isRiver,
  isRamp,
  rampRun,
  inBounds,
  cellToWorldX,
  cellToWorldZ,
  needsCliff,
  halfCliffEdges,
  cellHeightRange,
  ORTHOGONAL,
  waterEdges,
  FRINGE_DROP,
  heightField,
  sampleHeightField,
  shoreSdf,
  sampleShore,
  easedCellOutline,
  type LayerTest,
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

/** Surfaces that paint over the grass base, in the order they stack. */
const OVERLAY_SURFACES = [
  Surface.Sand,
  Surface.Soil,
  Surface.Stone,
  Surface.Wood,
  Surface.Brick,
];

/** Lift per overlay so it wins the depth test against the base without z-fighting. */
const OVERLAY_LIFT = 0.004;

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

/**
 * How far a walkable bank runs out into the lower cell, in tiles.
 *
 * A level is 0.75u, so the run sets the angle: 0.55 tiles is 54 degrees, 1.1 is
 * 34. It was 0.55, and at 54 degrees a one-level change read as a STEP rather
 * than a slope — David, 2026-07-29: "1 block height difference should be eased
 * and look like natural slight height changes".
 *
 * 1.1 is a deliberate compromise, not the gentlest option. The skirt is drawn
 * OVER the lower neighbour's ground, so a longer run reaches further into it,
 * and once it passes about 1.5 tiles two adjacent banks stepping the same way
 * start to overlap each other and z-fight. 34 degrees reads as a rise you walk
 * up without risking that. A cliff, for contrast, is vertical over 1.5u.
 */
const BANK_RUN = 1.1;

/** A layer's triangles, accumulated flat rather than as 11k BufferGeometries. */
interface Mesh {
  pos: number[];
  uv: number[];
  /** Explicit, because banks are sloped and the flat +Y default would flatten them. */
  nrm: number[];
  idx: number[];
}

const emptyMesh = (): Mesh => ({ pos: [], uv: [], nrm: [], idx: [] });

/**
 * Append one cell.
 *
 * Interior cells (nothing to ease) emit the plain two-triangle quad, so the
 * extra geometry stays on boundaries where it does something instead of on all
 * ~11k land cells. Boundary cells emit a centre-fan over the eased outline.
 */
function addCell(
  mesh: Mesh,
  inLayer: LayerTest,
  cx: number,
  cz: number,
  x: number,
  y: number,
  z: number,
  /** Per-vertex height offset. The seabed uses it; every flat layer omits it. */
  dip?: (px: number, pz: number) => number,
  /**
   * Per-vertex ground height. Supplied in smooth mode so a cell is no longer a
   * flat quad: four independent corner heights make the surface continuous with
   * its neighbours, which is the whole mechanism and costs no extra geometry.
   */
  heightAt?: (px: number, pz: number) => number,
  /** Cuts the cell into subdiv x subdiv quads. 1 is the plain single quad. */
  subdiv = 1
) {
  const s = 1 / (UV_CELLS_PER_REPEAT * TILE);
  const base = mesh.pos.length / 3;
  const push = (px: number, pz: number) => {
    const base = heightAt ? heightAt(px, pz) : y;
    mesh.pos.push(px, dip ? base - dip(px, pz) : base, pz);
    // UVs from WORLD position so neighbouring cells continue the pattern
    // instead of each restarting it.
    mesh.uv.push(px * s, pz * s);
    mesh.nrm.push(0, 1, 0);
  };

  const outline = easedCellOutline(inLayer, cx, cz);
  if (!outline) {
    const h = TILE / 2;
    if (subdiv > 1) {
      /**
       * A grid of quads, so a sloping cell curves rather than creasing. Only
       * used inside a blend; a flat cell gets the single quad below, because
       * subdividing 9200 flat cells would be 16x the triangles for nothing.
       */
      const step = TILE / subdiv;
      for (let iz = 0; iz <= subdiv; iz++) {
        for (let ix = 0; ix <= subdiv; ix++) {
          push(x - h + ix * step, z - h + iz * step);
        }
      }
      const row = subdiv + 1;
      for (let iz = 0; iz < subdiv; iz++) {
        for (let ix = 0; ix < subdiv; ix++) {
          const a = base + iz * row + ix;
          mesh.idx.push(a, a + row, a + row + 1, a, a + row + 1, a + 1);
        }
      }
      return;
    }
    push(x - h, z - h);
    push(x - h, z + h);
    push(x + h, z + h);
    push(x + h, z - h);
    mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return;
  }

  push(x, z); // fan centre
  for (const [ox, oz] of outline) push(x + ox, z + oz);
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    mesh.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % n));
  }
}

/**
 * Append the grass drape for one land-to-water edge.
 *
 * ACNH hangs a strip of alpha-cut grass over every water boundary, and it is
 * what makes the edge read as an edge rather than as the place the cells ran
 * out. The card is vertical, one tile wide, FRINGE_DROP tall, and hangs from
 * the land's own height -- so it reaches past the water surface (only 0.078u
 * below) and dips in.
 *
 * UVs run along WORLD position on the long axis, so the strip is continuous
 * across adjacent cells instead of restarting its blades at every boundary.
 * The source texture is 1024x32, a 32:1 strip, so one tile takes a 1/6 slice
 * to keep the blades at roughly their authored proportion.
 */
function addFringe(
  mesh: Mesh,
  x: number,
  z: number,
  topY: number,
  dx: number,
  dz: number
) {
  const half = TILE / 2;
  // Along-edge axis is the perpendicular of the outward direction.
  const ax = dz;
  const az = dx;
  const ex = x + dx * (half + FRINGE_OVERHANG);
  const ez = z + dz * (half + FRINGE_OVERHANG);
  const bottomY = topY - FRINGE_DROP;

  const base = mesh.pos.length / 3;
  const pts: [number, number, number][] = [
    [ex - ax * half, topY, ez - az * half],
    [ex + ax * half, topY, ez + az * half],
    [ex + ax * half, bottomY, ez + az * half],
    [ex - ax * half, bottomY, ez - az * half],
  ];
  // World-space U so neighbouring cards continue the same blades.
  const U = 1 / 6;
  const uAt = (px: number, pz: number) => (ax !== 0 ? pz : px) * U;
  const uvs: [number, number][] = [
    [uAt(pts[0][0], pts[0][2]), 0],
    [uAt(pts[1][0], pts[1][2]), 0],
    [uAt(pts[2][0], pts[2][2]), 1],
    [uAt(pts[3][0], pts[3][2]), 1],
  ];
  for (let i = 0; i < 4; i++) {
    mesh.pos.push(pts[i][0], pts[i][1], pts[i][2]);
    mesh.uv.push(uvs[i][0], uvs[i][1]);
    // Face outward over the water. The card is double-sided anyway, but a
    // correct normal means it catches the key light like the ground it hangs
    // from rather than going flat.
    mesh.nrm.push(dx, 0.35, dz);
  }
  mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Append a ramp: one cell that climbs a full level in `dir`.
 *
 * The only way to change level on foot now that every drop is a cliff. Stored at
 * the LOWER level, so the low edge sits flush with the ground it leaves and the
 * high edge meets the plateau it joins.
 *
 * The cliff outline routes AROUND this cell rather than sealing it, because
 * `sameLevelOrHigher` reports a ramp as the same tier and `dropTo` reports it as
 * no drop. Both live in grid.ts so the geometry and the autotile cannot disagree.
 */
/**
 * One tile's slice of a ramp run.
 *
 * Takes both heights rather than deriving the top from LEVEL_STEP: a run now
 * spans CLIFF_LEVELS across however many tiles it is long, so each tile carries
 * a fraction of the rise and no tile knows the whole climb.
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
  const s = 1 / (UV_CELLS_PER_REPEAT * TILE);
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
    mesh.uv.push(px * s, pz * s);
    mesh.nrm.push(nx, ny, nz);
  }
  // Wind from the cross product against the known normal, the same way addBank
  // does -- keying on the sign of the direction instead gets two of the four
  // orientations backfacing, which culls them into a hole.
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
  g.setIndex(mesh.idx);
  g.computeBoundingSphere();
  return g;
}

export default function GridTerrain({ map }: { map: IslandMap }) {
  // ONE field, read twice: the seabed geometry samples it on the CPU, the water
  // shader samples it on the GPU. Two bakes would be two shorelines.
  const field = useMemo(() => shoreSdf(map), [map]);

  /**
   * The continuous ground height. One field, read by the mesh here and by the
   * height provider in GridWorld, so the player walks on exactly the surface
   * that is drawn -- two separate calculations is how a character ends up
   * hovering over a hill.
   */
  const smooth = useMemo(
    // Guarded on the constant, not on a URL flag. At CLIFF_LEVELS 1 every level
    // change is a cliff, so the blur has nothing it is allowed to cross and
    // every corner keeps its own height -- 20ms of work for an identical result.
    // The branch stays so raising the constant revives smoothing for free.
    () => (CLIFF_LEVELS > 1 ? heightField(map) : null),
    [map]
  );

  const chunks = useMemo(() => {
    const out: { key: string; surface: number; geometry: THREE.BufferGeometry }[] = [];

    // ── Layer membership ────────────────────────────────────────
    // These decide where a corner gets cut, so they are about the SHAPE of the
    // land, not about which cells we happen to draw. `inGround` deliberately
    // still counts cliff cells: excluding them would cut the ground away at
    // the foot of every cliff and open a gap the cliff piece does not cover.

    // How far the bed drops below the surface at a given point. Reads the
    // SHIPPED tuning, not the live bench value: this is geometry, and rebuilding
    // 128x128 cells of it on every slider frame would stall the tab. Moving
    // `bedDepth` or `bedSlope` on the bench changes the colour instantly and the
    // bed shape on reload.
    const water = TUNING_DEFAULTS.water;
    const dipAt = (px: number, pz: number) => bedDepth(sampleShore(field, px, pz), water);

    /**
     * Per-CELL sampler, clamped to what that cell can legitimately reach.
     *
     * Not a single shared function, because the clamp depends on the cell: a
     * corner on a cliff boundary is pinned to the cliff top, and without the
     * clamp the low cell beside it samples that corner and rides halfway up the
     * wall. See `cellHeightRange`.
     */
    const groundFor = smooth
      ? (cx: number, cz: number) => {
          const range = cellHeightRange(map, cx, cz);
          if (!range) return (px: number, pz: number) => sampleHeightField(map, smooth, px, pz);
          const [lo, hi] = range;
          return (px: number, pz: number) => {
            const h = sampleHeightField(map, smooth, px, pz);
            return h < lo ? lo : h > hi ? hi : h;
          };
        }
      : undefined;

    /**
     * How finely to cut a cell, so a blend curves instead of creasing.
     *
     * One quad per cell gives four height samples across a whole blend, and
     * linear interpolation between them leaves visible facets -- measured second
     * derivatives of 0.34 and -0.52 across a three-cell rise, which is a crease
     * you can see. Subdividing only where the ground is actually sloping keeps
     * the extra triangles off the ~9200 flat cells that do not need them.
     */
    const subdivFor = (cx: number, cz: number) => {
      if (!smooth) return 1;
      const here = levelAt(map, cx, cz);
      for (const [dx, dz] of ORTHOGONAL) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!inBounds(map, nx, nz) || isVoid(surfaceAt(map, nx, nz))) continue;
        const d = Math.abs(levelAt(map, nx, nz) - here);
        if (d > 0 && d < CLIFF_LEVELS) return 4; // inside a blend
      }
      return 1;
    };

    const inGround: LayerTest = (cx, cz) =>
      inBounds(map, cx, cz) && !isVoid(surfaceAt(map, cx, cz)) && !isRiver(surfaceAt(map, cx, cz));
    const inSurface = (s: number): LayerTest => (cx, cz) =>
      inBounds(map, cx, cz) && surfaceAt(map, cx, cz) === s;

    for (const chunk of listChunks(map)) {
      const grass = emptyMesh();
      const river = emptyMesh();
      const bed = emptyMesh();
      const fringe = emptyMesh();
      const ramp = emptyMesh();
      const overlays = new Map<number, Mesh>();

      for (let cz = chunk.minCellZ; cz <= chunk.maxCellZ; cz++) {
        for (let cx = chunk.minCellX; cx <= chunk.maxCellX; cx++) {
          const s = surfaceAt(map, cx, cz);
          if (isVoid(s)) continue; // open sea: no ground, nothing to draw
          if (needsCliff(map, cx, cz)) continue; // the cliff piece brings its own top

          const x = cellToWorldX(map, cx);
          const z = cellToWorldZ(map, cz);
          const y = levelAt(map, cx, cz) * LEVEL_STEP;

          // A ramp replaces its own ground quad: the sloped surface IS the cell.
          if (isRamp(s)) {
            const run = rampRun(map, cx, cz);
            if (run) {
              // This tile's slice of the run, so a two-tile ramp is one
              // continuous slope rather than two separate one-level ramps.
              const lowY = (run.base + (run.index / run.length) * run.rise) * LEVEL_STEP;
              const highY = (run.base + ((run.index + 1) / run.length) * run.rise) * LEVEL_STEP;
              addRamp(ramp, x, z, lowY, highY, run.dir[0], run.dir[1]);
            } else {
              addCell(grass, inGround, cx, cz, x, y, z, undefined, groundFor?.(cx, cz), subdivFor(cx, cz));
            }
            continue;
          }

          if (isRiver(s)) {
            // NOT eased, and drawn full-square on purpose: the rounded grass
            // bank overlaps it from above, so cutting its corners would open a
            // gap between the two.
            addCell(river, () => true, cx, cz, x, y - WATER_DROP, z);
            // The bed under it, sloping away from the bank. David approved
            // bathymetry 2026-07-29: the reference colour ramp ends in the
            // SEABED colour, so there has to be a seabed and it has to get
            // further away as the water deepens, or the ramp has nothing to
            // ramp over. Depth comes from `bedDepth`, the same function the
            // shader mirrors in GLSL.
            addCell(bed, () => true, cx, cz, x, y - WATER_DROP, z, dipAt);
            continue;
          }

          addCell(grass, inGround, cx, cz, x, y, z, undefined, groundFor?.(cx, cz), subdivFor(cx, cz));

          // Walkable step down to a neighbour: a sloped skirt, not a kit
          // piece. This is the whole visible difference between a bank and a
          // cliff, and it lives here because it is terrain, not an object.
          // A one-level drop is BLENDED, not faced. David, 2026-07-30: "the half
          // steps needs blending, and will be rarely used for island
          // naturalness, otherwise keep everything either flat or with 1 unit
          // high cliffs."
          //
          // The height field already does exactly that: its blur crosses
          // anything under CLIFF_LEVELS and treats a full drop as a barrier, so
          // a one-level change comes out as a soft rise and a two-level change
          // stays razor sharp for the kit piece. Nothing to draw here -- and the
          // previous commit drew a vertical face INTO that same slope, which is
          // the bug this replaces.

          // Grass hanging over a water edge. Without this the river simply
          // stops where its cells end -- the old world needed RiverBanks and
          // RiverBankWalls to hide the same seam, and this is the kit's own
          // answer to it.
          for (const [dx, dz] of waterEdges(map, cx, cz)) {
            addFringe(fringe, x, z, groundFor ? groundFor(cx, cz)(x, z) : y, dx, dz);
          }

          if (s !== Surface.Grass) {
            const m = overlays.get(s) ?? emptyMesh();
            addCell(
              m,
              inSurface(s),
              cx,
              cz,
              x,
              y + OVERLAY_LIFT,
              z,
              undefined,
              groundFor
                ? ((g) => (px: number, pz: number) => g(px, pz) + OVERLAY_LIFT)(groundFor(cx, cz))
                : undefined
            );
            overlays.set(s, m);
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
      for (const s of OVERLAY_SURFACES) {
        const m = overlays.get(s);
        if (m) emit(s, m);
      }
    }
    return out;
  }, [map, field, smooth]);

  // The water reads its distance to the shore from a baked field rather than
  // from anything on the mesh, so this is a one-shot upload, not geometry.
  useEffect(() => {
    setShoreField(field);
  }, [field]);

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
    };
    const m = new Map<number, THREE.Material>();
    for (const s of [
      Surface.Grass,
      RIVER_BED,
      Surface.River,
      WATER_FRINGE,
      RAMP_LAYER,
      ...OVERLAY_SURFACES,
    ]) {
      const sharedName = SHARED[s];
      const shared = sharedName ? terrainMaterial(sharedName) : null;
      if (shared) {
        m.set(s, shared);
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
    return m;
  }, []);

  return (
    <group>
      {chunks.map((c) => (
        <mesh key={c.key} geometry={c.geometry} material={materials.get(c.surface)} receiveShadow />
      ))}
    </group>
  );
}
