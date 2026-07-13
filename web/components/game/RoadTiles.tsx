"use client";

/**
 * RoadTiles (P2 polish 2026-07-13) — the real ACNH road system.
 *
 * Replaces the painted alpha-ribbon paths with the actual road tile
 * geometry from the dump (Terrain/unit-road-soil): 0.89u grid cells
 * auto-tiled over the PATH_CORRIDORS rectangles with marching-squares
 * variants — plain interior (4-a), soft-wobble edge (1-a, soft side +Z at
 * rot 0), rounded outer corner (2-b, spanning +Z/-X at rot 0). Layout and
 * rotation conventions were locked visually in the tile harness.
 *
 * Four InstancedMeshes total (one per variant) — the whole road network is
 * 4 draw calls. Everything is static: built once in useMemo, never mutated.
 *
 * The N-S spine splits at the river banks (the bridge deck owns the
 * crossing), mirroring the Path split from 47edb40.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getTerrainHeight } from "./terrain";

const CELL = 0.89; // one ACNH road unit (8.9 raw) at world scale 0.1
const SCALE = 0.1;

// Corridor rectangles in world XZ — keep in sync with PATH_CORRIDORS in
// terrain.ts (same extents; spine split at the river like the old Path).
const RECTS = [
  { x0: -1.75, x1: 1.75, z0: -24, z1: -1.1 },
  { x0: -1.75, x1: 1.75, z0: 5.9, z1: 27 },
  { x0: -26, x1: 26, z0: 8.25, z1: 11.75 },
  { x0: -17, x1: 17, z0: -14.75, z1: -11.25 },
];

const URLS = {
  interior: "/assets/acnh/road/4-a.glb",
  edge: "/assets/acnh/road/1-a.glb",
  corner: "/assets/acnh/road/2-b.glb",
  cap: "/assets/acnh/road/0-a.glb",
} as const;
Object.values(URLS).forEach((u) => useGLTF.preload(u));

function isRoad(x: number, z: number): boolean {
  return RECTS.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}

function mergedGeometry(scene: THREE.Group): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const cl = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(cl.attributes)) {
        if (!["position", "normal", "uv"].includes(k)) cl.deleteAttribute(k);
      }
      geos.push(cl);
    }
  });
  return mergeGeometries(geos, false) ?? geos[0];
}

interface Placement { x: number; z: number; rot: number }

function computePlacements(): Record<keyof typeof URLS, Placement[]> {
  const out: Record<string, Placement[]> = { interior: [], edge: [], corner: [], cap: [] };
  for (let gx = -32; gx <= 32; gx++) {
    for (let gz = -30; gz <= 33; gz++) {
      // half-cell offset: corridors span an even tile count symmetrically
      const cx = (gx + 0.5) * CELL;
      const cz = (gz + 0.5) * CELL;
      if (!isRoad(cx, cz)) continue;
      const n = isRoad(cx, cz + CELL);
      const s = isRoad(cx, cz - CELL);
      const e = isRoad(cx - CELL, cz);
      const w = isRoad(cx + CELL, cz);
      const missing = [!n, !s, !e, !w].filter(Boolean).length;
      let kind: keyof typeof URLS = "interior";
      let rot = 0;
      if (missing === 1) {
        kind = "edge";
        rot = !n ? 0 : !s ? Math.PI : !w ? Math.PI / 2 : -Math.PI / 2;
      } else if (missing === 2) {
        if ((!n && !s) || (!e && !w)) {
          kind = "interior"; // opposite-sided exposure never happens at 4-wide
        } else {
          kind = "corner";
          rot = !n && !e ? 0 : !n && !w ? Math.PI / 2 : !s && !w ? Math.PI : -Math.PI / 2;
        }
      } else if (missing >= 3) {
        kind = "cap";
      }
      out[kind].push({ x: cx, z: cz, rot });
    }
  }
  return out as Record<keyof typeof URLS, Placement[]>;
}

export default function RoadTiles() {
  const gInterior = useGLTF(URLS.interior);
  const gEdge = useGLTF(URLS.edge);
  const gCorner = useGLTF(URLS.corner);
  const gCap = useGLTF(URLS.cap);

  const meshes = useMemo(() => {
    const geos: Record<keyof typeof URLS, THREE.BufferGeometry> = {
      interior: mergedGeometry(gInterior.scene),
      edge: mergedGeometry(gEdge.scene),
      corner: mergedGeometry(gCorner.scene),
      cap: mergedGeometry(gCap.scene),
    };
    const mat = new THREE.MeshStandardMaterial({ color: "#C9A66B", roughness: 0.92, metalness: 0 });
    const placements = computePlacements();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(SCALE, SCALE, SCALE);
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const result: THREE.InstancedMesh[] = [];
    for (const kind of Object.keys(placements) as (keyof typeof URLS)[]) {
      const list = placements[kind];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geos[kind], mat, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot);
        p.set(t.x, getTerrainHeight(t.x, t.z) + 0.02, t.z);
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      result.push(im);
    }
    return result;
  }, [gInterior.scene, gEdge.scene, gCorner.scene, gCap.scene]);

  return (
    <group>
      {meshes.map((im, i) => (
        <primitive key={i} object={im} />
      ))}
    </group>
  );
}
