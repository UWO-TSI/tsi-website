"use client";

/**
 * Instanced rendering for nature kit GLBs (perf 2026-06-01).
 *
 * Replaces per-position `<NatureGLB>` clones (one draw call per instance
 * per sub-mesh) with `<Instances>` from drei — one draw call per
 * sub-mesh shared across N positions. ~5-15x reduction in draws for
 * scenes with many repeats (trees, bushes, flowers).
 *
 * Each GLB may have multiple sub-meshes (trunk + canopy). We extract
 * each sub-mesh's geometry+material and create one Instances group per
 * sub-mesh, then synchronize a list of transforms across all groups so
 * each "logical" instance shares one transform.
 *
 * Limitations:
 *  - GLB materials must be MeshStandardMaterial-compatible (they are
 *    for Kenney/Quaternius kits).
 *  - Transforms are computed at mount; dynamic position changes after
 *    mount require re-rendering this component. Fine for static scenery.
 */

import { useMemo } from "react";
import { Instances, Instance, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface NaturePlacement {
  position: [number, number, number];
  rotation?: number; // y-axis radians
  scale?: number;
}

interface SubMesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

function extractSubMeshes(scene: THREE.Object3D): SubMesh[] {
  const out: SubMesh[] = [];
  scene.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      // For most Kenney/Quaternius kits the material is a single object,
      // not an array. Handle both defensively.
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      out.push({ geometry: m.geometry, material: mat });
    }
  });
  return out;
}

interface InstancedGLBProps {
  url: string;
  placements: NaturePlacement[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Per-instance scale multiplier — multiplied with the placement's scale. */
  baseScale?: number;
}

/**
 * Render N instances of one GLB. One `<Instances>` group per sub-mesh
 * inside the GLB. All groups share the same instance transforms so the
 * sub-meshes stay aligned per "logical" instance.
 */
export default function InstancedGLB({
  url,
  placements,
  castShadow = true,
  receiveShadow = true,
  baseScale = 1,
}: InstancedGLBProps) {
  const { scene } = useGLTF(url);
  const subMeshes = useMemo(() => extractSubMeshes(scene), [scene]);

  if (subMeshes.length === 0) return null;

  return (
    <>
      {subMeshes.map((sm, i) => (
        <Instances
          key={i}
          // Limit — drei default is 1000, more than enough for our scene.
          limit={Math.max(placements.length, 16)}
          geometry={sm.geometry}
          material={sm.material}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        >
          {placements.map((p, j) => (
            <Instance
              key={j}
              position={p.position}
              rotation={[0, p.rotation ?? 0, 0]}
              scale={(p.scale ?? 1) * baseScale}
            />
          ))}
        </Instances>
      ))}
    </>
  );
}
