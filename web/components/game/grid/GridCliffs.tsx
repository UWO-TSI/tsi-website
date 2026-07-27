"use client";

/**
 * GridCliffs (M4, 2026-07-26) — the ACNH cliff kit, placed by the autotiler.
 *
 * Every raised cell with a lower neighbour gets a piece. Which piece comes
 * from `cliffPieceFor`, which runs the neighbour mask through the autotile
 * solver and looks the config up in the table DERIVED by measuring where each
 * of the 44 meshes carries wall geometry (scripts/derive-kit-mapping.mjs) —
 * not guessed, and not eyeballed.
 *
 * The trailing number in a filename is a VISUAL VARIANT, not a rotation: all
 * four files in a family share a wall centroid, which a rotation would move.
 * ACNH varies rock detail so a long cliff run does not look tiled. So we pick
 * a variant per cell and apply the rotation ourselves.
 *
 * One InstancedMesh per (file, sub-mesh). The kit is 44 files but a real map
 * touches a handful, and each is drawn once however many cells use it.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { type IslandMap, listChunks, cliffPieceFor, cellToWorldX, cellToWorldZ } from "@/lib/game/grid";
import { terrainMaterial } from "./terrainMaterials";

// Raw dump units are 10x world units; the kit ships raw, like buildings do.
const KIT_SCALE = 0.1;
const CLIFF_DIR = "/assets/acnh/cliff/";

interface Placement {
  x: number;
  z: number;
  y: number;
  rotation: number;
}

/** Every cliff placement on the map, bucketed by which file it wants. */
function useCliffPlacements(map: IslandMap): Map<string, Placement[]> {
  return useMemo(() => {
    const byFile = new Map<string, Placement[]>();
    for (const chunk of listChunks(map)) {
      for (let cz = chunk.minCellZ; cz <= chunk.maxCellZ; cz++) {
        for (let cx = chunk.minCellX; cx <= chunk.maxCellX; cx++) {
          const piece = cliffPieceFor(map, cx, cz);
          if (!piece) continue;
          const list = byFile.get(piece.file) ?? [];
          list.push({
            x: cellToWorldX(map, cx),
            z: cellToWorldZ(map, cz),
            y: piece.y,
            rotation: piece.rotation,
          });
          byFile.set(piece.file, list);
        }
      }
    }
    return byFile;
  }, [map]);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(KIT_SCALE, KIT_SCALE, KIT_SCALE);
const _euler = new THREE.Euler();

/** One kit file, instanced across every cell that asked for it. */
function CliffPiece({ file, placements }: { file: string; placements: Placement[] }) {
  const { scene } = useGLTF(CLIFF_DIR + file);

  // Pull geometry+material per sub-mesh. Safe to read straight off the source
  // (rather than cloning) because InstancedMesh never mutates them, and the
  // extractor already stripped the skinning that would have made this unsafe.
  const subMeshes = useMemo(() => {
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      // The kit's own materials are unusable: no textures (they live in the
      // shared FldUnit asset) and baseColorFactor [0,0,0,0], which renders
      // every cliff face as a black slab. Swap to the shared terrain set,
      // matched by ACNH material name. See terrainMaterials.ts.
      const shared = terrainMaterial(own?.name ?? mesh.name ?? "");
      out.push({ geometry: mesh.geometry, material: shared ?? own });
    });
    return out;
  }, [scene]);

  return (
    <group>
      {subMeshes.map((sm, i) => (
        <instancedMesh
          key={i}
          args={[sm.geometry, sm.material, placements.length]}
          receiveShadow
          // Instanced bounds do not follow per-instance transforms well enough
          // for a spread-out set; culling the whole batch when the origin
          // leaves view would pop entire cliff runs.
          frustumCulled={false}
          ref={(inst) => {
            if (!inst) return;
            placements.forEach((p, idx) => {
              _euler.set(0, (-p.rotation * Math.PI) / 2, 0);
              _q.setFromEuler(_euler);
              _p.set(p.x, p.y, p.z);
              _m.compose(_p, _q, _s);
              inst.setMatrixAt(idx, _m);
            });
            inst.instanceMatrix.needsUpdate = true;
          }}
        />
      ))}
    </group>
  );
}

export default function GridCliffs({ map }: { map: IslandMap }) {
  const byFile = useCliffPlacements(map);
  return (
    <group>
      {[...byFile.entries()].map(([file, placements]) => (
        <CliffPiece key={file} file={file} placements={placements} />
      ))}
    </group>
  );
}
