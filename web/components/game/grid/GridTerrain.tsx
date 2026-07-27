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

/** A layer's triangles, accumulated flat rather than as 11k BufferGeometries. */
interface Mesh {
  pos: number[];
  uv: number[];
  idx: number[];
}

const emptyMesh = (): Mesh => ({ pos: [], uv: [], idx: [] });

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

function build(mesh: Mesh): THREE.BufferGeometry | null {
  if (mesh.idx.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(mesh.pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uv, 2));
  const normals = new Float32Array(mesh.pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
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
