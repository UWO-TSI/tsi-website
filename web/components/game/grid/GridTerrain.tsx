"use client";

/**
 * GridTerrain (M4, 2026-07-26) — the ACNH ground plane.
 *
 * ACNH's entire ground is `FldUnit/Base_0.dae`: one 4-vertex 10x10 quad. This
 * builds the same thing, one quad per cell at `level * 1.5`, merged per
 * 16x16 acre and per surface material.
 *
 * WHY CHUNKED. The old terrain was a single 150x150 PlaneGeometry — 93k
 * triangles the GPU processed no matter where the camera pointed, with ~48% of
 * it outside the island entirely. One geometry cannot be frustum-culled. An
 * acre can, and it is also ACNH's own authoring unit.
 *
 * Cells that need a cliff piece are SKIPPED here: an ACNH cliff piece carries
 * its own grass top, so emitting a quad underneath would z-fight with it.
 * GridCliffs draws those.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  cellToWorldX,
  cellToWorldZ,
  needsCliff,
} from "@/lib/game/grid";
import { terrainMaterial } from "./terrainMaterials";

// Flat colours for now. The atlas pass (one 2048 sheet for the whole terrain
// set, measured feasible in the systems doc — source textures are 32x48 to
// 512x512) is a later optimisation; this keeps M4 about geometry.
const SURFACE_COLOR: Record<number, string> = {
  [Surface.Grass]: "#7CAE56",
  [Surface.Soil]: "#BA9664",
  [Surface.Stone]: "#B0ACA6",
  [Surface.Sand]: "#E2CB93",
  [Surface.Wood]: "#A0784E",
  [Surface.Brick]: "#BA7A68",
  [Surface.River]: "#568CB2",
};

const SURFACES_DRAWN = [
  Surface.Grass,
  Surface.Soil,
  Surface.Stone,
  Surface.Sand,
  Surface.Wood,
  Surface.Brick,
  Surface.River,
];

// How many cells one repeat of a ground texture covers. PlaneGeometry's own
// 0..1 UVs put the WHOLE texture on every single cell, which turned the lawn
// into hard green/yellow stripes — an ACNH ground texture is a tiling pattern
// meant to run continuously across the terrain, not a per-tile decal.
const UV_CELLS_PER_REPEAT = 4;

/** One flat quad, +Y up, centred on the cell, with continuous world UVs. */
function quad(x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(TILE, TILE);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);

  // Re-derive UVs from world position so neighbouring cells continue the
  // pattern instead of each restarting it.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const s = 1 / (UV_CELLS_PER_REPEAT * TILE);
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * s, pos.getZ(i) * s);
  }
  uv.needsUpdate = true;
  return g;
}

export default function GridTerrain({ map }: { map: IslandMap }) {
  const chunks = useMemo(() => {
    const out: { key: string; surface: number; geometry: THREE.BufferGeometry }[] = [];

    for (const chunk of listChunks(map)) {
      // Bucket this acre's cells by surface, so each bucket merges into one
      // draw. A chunk touches at most 7 materials and usually 2 or 3.
      const buckets = new Map<number, THREE.BufferGeometry[]>();

      for (let cz = chunk.minCellZ; cz <= chunk.maxCellZ; cz++) {
        for (let cx = chunk.minCellX; cx <= chunk.maxCellX; cx++) {
          const s = surfaceAt(map, cx, cz);
          if (isVoid(s)) continue; // open sea: no ground, nothing to draw
          if (needsCliff(map, cx, cz)) continue; // the cliff piece brings its own top

          const level = levelAt(map, cx, cz);
          // River water sits just below its own ground level — measured 0.78
          // raw off River0A_0, not invented.
          const y = level * LEVEL_STEP - (s === Surface.River ? WATER_DROP : 0);
          const list = buckets.get(s) ?? [];
          list.push(quad(cellToWorldX(map, cx), y, cellToWorldZ(map, cz)));
          buckets.set(s, list);
        }
      }

      for (const s of SURFACES_DRAWN) {
        const geos = buckets.get(s);
        if (!geos || geos.length === 0) continue;
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        out.push({ key: `${chunk.chunkX}:${chunk.chunkZ}:${s}`, surface: s, geometry: merged });
      }
    }
    return out;
  }, [map]);

  const materials = useMemo(() => {
    // Grass, sand and river reuse the shared ACNH terrain textures so the
    // ground matches the cliff tops exactly — the cliff kit's own grass top is
    // the same mGrass_Grd. The rest stay flat colour until their road-kit
    // textures are wired.
    const SHARED: Partial<Record<number, string>> = {
      [Surface.Grass]: "mGrass",
      [Surface.Sand]: "mSand",
      [Surface.River]: "mRiver",
    };
    const m = new Map<number, THREE.Material>();
    for (const s of SURFACES_DRAWN) {
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
