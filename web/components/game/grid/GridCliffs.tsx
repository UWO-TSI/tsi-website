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
 * Drawn as static blocks (cliffBlocks.ts, v1 performance): every placement's sub-meshes baked into world space and
 * merged per shared material per block of 4 x 4 chunks, each block shown while the curved world can bring it into
 * view (lib/game/curvedCull.ts). It used to be one InstancedMesh per (file, sub-mesh), never culled: 270 of the v2
 * world's 700 draw calls.
 */

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type IslandMap, listChunks, cliffPieceFor, cellToWorldX, cellToWorldZ } from "@/lib/game/grid";
import { CurvedCull, cullMeshes } from "@/lib/game/curvedCull";
import { terrainMaterial } from "./terrainMaterials";
import { cliffBlocks, type CliffMaterial, type CliffPlacement } from "./cliffBlocks";
import { GROUND_UV } from "./GridTerrain";
import type { GroundSet } from "@/lib/game/groundTextures";

const CLIFF_DIR = "/assets/acnh/cliff/";

/** Every cliff placement on the map, bucketed by which file it wants. */
function useCliffPlacements(map: IslandMap): Map<string, CliffPlacement[]> {
  return useMemo(() => {
    const byFile = new Map<string, CliffPlacement[]>();
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

/**
 * The shared material a kit sub-mesh draws with. The kit's own materials are unusable: no textures (they live in the
 * shared FldUnit asset) and baseColorFactor [0,0,0,0], which renders every cliff face as a black slab. Swap to the
 * shared terrain set, matched by ACNH material name (terrainMaterials.ts). The kit's grass top and drape wear the
 * island's own grass, so a plateau is the same lawn as the ground; the grass top with the ground's world UVs.
 */
function kitMaterial(own: THREE.Material | undefined, mesh: THREE.Mesh, ground: GroundSet, grass?: THREE.Material, drape?: THREE.Material): CliffMaterial {
  const name = own?.name ?? mesh.name ?? "";
  const island = name.includes("mGrassCliffXlu") ? drape : name.includes("mGrass") ? grass : undefined;
  const material = island ?? terrainMaterial(name, ground) ?? own!;
  return { material, worldUv: !!grass && material === grass };
}

/**
 * `grass`, `drape`: the island's grass and its drape (GridTerrain's materials), for the kit's grass top and lip.
 * `ground`: whose textures the walls wear (lib/game/groundTextures.ts), the world's own as its ground has them.
 */
export default function GridCliffs({ map, grass, drape, ground = "dump" }: { map: IslandMap; grass?: THREE.Material; drape?: THREE.Material; ground?: GroundSet }) {
  const byFile = useCliffPlacements(map);
  const files = useMemo(() => [...byFile.keys()], [byFile]);
  const gltfs = useGLTF(files.map(f => CLIFF_DIR + f)) as unknown as { scene: THREE.Object3D }[];
  const meshes = useMemo(() => cliffBlocks(map, files, gltfs.map(g => g.scene), byFile, (own, mesh) => kitMaterial(own, mesh, ground, grass, drape), GROUND_UV),
    [map, files, gltfs, byFile, grass, drape, ground]);
  useEffect(() => () => meshes.forEach(m => m.geometry.dispose()), [meshes]);
  const cull = useMemo(() => new CurvedCull(), []);
  useFrame(({ camera }) => cullMeshes(cull.update(camera), meshes));
  return (
    <group>
      {meshes.map((m) => <primitive key={m.name} object={m} />)}
    </group>
  );
}
