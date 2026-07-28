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

import { useMemo } from "react";
import * as THREE from "three";
import {
  type IslandMap,
  Surface,
  TILE,
  LEVEL_STEP,
  WATER_DROP,
  listChunks,
  levelAt,
  surfaceAt,
  isVoid,
  isRiver,
  inBounds,
  cellToWorldX,
  cellToWorldZ,
  needsCliff,
  bankEdges,
  easedCellOutline,
  type LayerTest,
} from "@/lib/game/grid";
import { terrainMaterial } from "./terrainMaterials";

// Flat colours for the surfaces whose road-kit textures are not wired yet.
const SURFACE_COLOR: Record<number, string> = {
  [Surface.Grass]: "#7CAE56",
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

// How many cells one repeat of a ground texture covers. PlaneGeometry's own
// 0..1 UVs put the WHOLE texture on every single cell, which turned the lawn
// into hard green/yellow stripes — an ACNH ground texture is a tiling pattern
// meant to run continuously across the terrain, not a per-tile decal.
const UV_CELLS_PER_REPEAT = 2;

/**
 * How far a walkable bank runs out into the lower cell, in tiles.
 *
 * A level is 0.75u and a bank falls exactly one of them, so at 0.55 tiles of
 * run the slope is about 54 degrees — steep enough to read as a bank rather
 * than a lawn, shallow enough to read as something you walk up rather than a
 * wall. A cliff, for contrast, is vertical over 1.5u.
 */
const BANK_RUN = 0.55;

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
function addCell(mesh: Mesh, inLayer: LayerTest, cx: number, cz: number, x: number, y: number, z: number) {
  const s = 1 / (UV_CELLS_PER_REPEAT * TILE);
  const base = mesh.pos.length / 3;
  const push = (px: number, pz: number) => {
    mesh.pos.push(px, y, pz);
    // UVs from WORLD position so neighbouring cells continue the pattern
    // instead of each restarting it.
    mesh.uv.push(px * s, pz * s);
    mesh.nrm.push(0, 1, 0);
  };

  const outline = easedCellOutline(inLayer, cx, cz);
  if (!outline) {
    const h = TILE / 2;
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
 * Append the sloped skirt for one walkable step down.
 *
 * The top edge sits on the cell boundary at the cell's own height; the bottom
 * edge runs BANK_RUN out into the lower neighbour and down to its height. It
 * deliberately overlaps the neighbour's ground rather than meeting it exactly:
 * an exact meeting leaves a hairline of sky at grazing angles, and the overlap
 * costs nothing because the neighbour's quad is flat underneath.
 *
 * Normals are the true slope normal, so a bank catches the key light
 * differently from the flat ground on either side. That shading difference is
 * most of what makes the step readable at all.
 */
function addBank(
  mesh: Mesh,
  x: number,
  z: number,
  topY: number,
  bottomY: number,
  dx: number,
  dz: number
) {
  const s = 1 / (UV_CELLS_PER_REPEAT * TILE);
  const half = TILE / 2;
  // Along-edge axis is the perpendicular of the step direction.
  const ax = dz;
  const az = dx;
  const ex = x + dx * half;
  const ez = z + dz * half;
  const ox = ex + dx * BANK_RUN;
  const oz = ez + dz * BANK_RUN;

  const drop = topY - bottomY;
  const len = Math.hypot(drop, BANK_RUN) || 1;
  // Slope normal: horizontal component points down the slope, vertical up.
  const nx = (dx * drop) / len;
  const ny = BANK_RUN / len;
  const nz = (dz * drop) / len;

  const base = mesh.pos.length / 3;
  const pts: [number, number, number][] = [
    [ex - ax * half, topY, ez - az * half],
    [ex + ax * half, topY, ez + az * half],
    [ox + ax * half, bottomY, oz + az * half],
    [ox - ax * half, bottomY, oz - az * half],
  ];
  for (const [px, py, pz] of pts) {
    mesh.pos.push(px, py, pz);
    mesh.uv.push(px * s, pz * s);
    mesh.nrm.push(nx, ny, nz);
  }

  // Wind so the face points up-slope, DERIVED rather than hand-cased.
  //
  // The hand-cased version keyed the flip on `dx + dz > 0`, which is the sign
  // of the step direction. The correct discriminator is the AXIS, not the sign,
  // so two of the four directions came out backfacing — and a backfacing bank
  // is culled, which showed as a pale hole straight through the terrain to the
  // sky. Comparing the triangle's own cross product against the normal we
  // already know cannot get that wrong, whatever the corner order happens to be.
  const [a, b, c] = pts;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const facing =
    (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
  if (facing > 0) {
    mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  } else {
    mesh.idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
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
  const chunks = useMemo(() => {
    const out: { key: string; surface: number; geometry: THREE.BufferGeometry }[] = [];

    // ── Layer membership ────────────────────────────────────────
    // These decide where a corner gets cut, so they are about the SHAPE of the
    // land, not about which cells we happen to draw. `inGround` deliberately
    // still counts cliff cells: excluding them would cut the ground away at
    // the foot of every cliff and open a gap the cliff piece does not cover.
    const inGround: LayerTest = (cx, cz) =>
      inBounds(map, cx, cz) && !isVoid(surfaceAt(map, cx, cz)) && !isRiver(surfaceAt(map, cx, cz));
    const inSurface = (s: number): LayerTest => (cx, cz) =>
      inBounds(map, cx, cz) && surfaceAt(map, cx, cz) === s;

    for (const chunk of listChunks(map)) {
      const grass = emptyMesh();
      const river = emptyMesh();
      const overlays = new Map<number, Mesh>();

      for (let cz = chunk.minCellZ; cz <= chunk.maxCellZ; cz++) {
        for (let cx = chunk.minCellX; cx <= chunk.maxCellX; cx++) {
          const s = surfaceAt(map, cx, cz);
          if (isVoid(s)) continue; // open sea: no ground, nothing to draw
          if (needsCliff(map, cx, cz)) continue; // the cliff piece brings its own top

          const x = cellToWorldX(map, cx);
          const z = cellToWorldZ(map, cz);
          const y = levelAt(map, cx, cz) * LEVEL_STEP;

          if (isRiver(s)) {
            // NOT eased, and drawn full-square on purpose. Nothing is beneath
            // the water, so cutting its corners would show sky; instead the
            // rounded grass bank overlaps it from above.
            addCell(river, () => true, cx, cz, x, y - WATER_DROP, z);
            continue;
          }

          addCell(grass, inGround, cx, cz, x, y, z);

          // Walkable step down to a neighbour: a sloped skirt, not a kit
          // piece. This is the whole visible difference between a bank and a
          // cliff, and it lives here because it is terrain, not an object.
          for (const [dx, dz, drop] of bankEdges(map, cx, cz)) {
            addBank(grass, x, z, y, y - drop * LEVEL_STEP, dx, dz);
          }

          if (s !== Surface.Grass) {
            const m = overlays.get(s) ?? emptyMesh();
            addCell(m, inSurface(s), cx, cz, x, y + OVERLAY_LIFT, z);
            overlays.set(s, m);
          }
        }
      }

      const emit = (surface: number, mesh: Mesh) => {
        const g = build(mesh);
        if (g) out.push({ key: `${chunk.chunkX}:${chunk.chunkZ}:${surface}`, surface, geometry: g });
      };
      emit(Surface.Grass, grass);
      emit(Surface.River, river);
      for (const s of OVERLAY_SURFACES) {
        const m = overlays.get(s);
        if (m) emit(s, m);
      }
    }
    return out;
  }, [map]);

  const materials = useMemo(() => {
    // Names, not files — terrainMaterial() decides whether a surface gets an
    // ACNH texture or a procedural one, because two of the ACNH files are not
    // what their names imply (mGrass_Grd is a colour ramp, mRiver_Alb is the
    // riverbed). See terrainMaterials.ts.
    const SHARED: Partial<Record<number, string>> = {
      [Surface.Grass]: "mGrass",
      [Surface.Sand]: "mSand",
      [Surface.River]: "mRiver",
    };
    const m = new Map<number, THREE.Material>();
    for (const s of [Surface.Grass, Surface.River, ...OVERLAY_SURFACES]) {
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
