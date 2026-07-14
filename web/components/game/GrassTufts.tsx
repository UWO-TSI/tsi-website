"use client";

/**
 * GrassTufts (P2 ground detail, 2026-07-13) — ACNH's own proc-grass cards
 * (Terrain/proc-grass) scattered over the island. ~140 seeded tufts in
 * three shape variants, rejected near roads / river / buildings / rim.
 * Three static InstancedMeshes; tinted slightly darker than the ground so
 * they read as texture, not clutter. Part of David's "ground needs work"
 * polish round.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight, BUILDING_FOOTPRINTS } from "./terrain";
import { coastDist, coastWobble, rimSink } from "@/lib/game/coast";

const VARIANTS = [
  "/assets/acnh/props/grass-tuft-00.glb",
  "/assets/acnh/props/grass-tuft-01.glb",
  "/assets/acnh/props/grass-tuft-02.glb",
];
VARIANTS.forEach((u) => useGLTF.preload(u));

const COUNT = 90; // perf pass 2026-07-13 (was 140)
const SCALE = 0.1;

// road corridors (mirror RoadTiles RECTS, padded a touch)
const ROAD_RECTS = [
  { x0: -2.4, x1: 2.4, z0: -25, z1: 28 },
  { x0: -27, x1: 27, z0: 7.6, z1: 12.4 },
  { x0: -18, x1: 18, z0: -15.4, z1: -10.6 },
  // Beach Cove spur + deck pad
  { x0: 0.5, x1: 20.7, z0: 21.3, z1: 26.2 },
  { x0: 15.8, x1: 20.7, z0: 26.2, z1: 44.9 },
];

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dune grass (iteration 4): dry tufts on the WIDE sand sweeps
// (beachWidthShift maxima at θ≈1.85 and θ≈4.99), placed by angle in
// coast-space and colored drier than the meadow tufts.
// [angleRad, coastDistE, rot, scale]
const DUNE_SPOTS: [number, number, number, number][] = [
  [1.77, 48.8, 0.4, 0.55],
  [1.81, 49.5, 2.1, 0.62],
  [1.86, 48.9, 3.7, 0.48],
  [1.9, 49.7, 1.2, 0.58],
  [1.94, 49.1, 5.1, 0.5],
  [4.91, 49.0, 0.9, 0.6],
  [4.96, 49.6, 2.8, 0.52],
  [5.02, 48.8, 4.4, 0.62],
  [5.07, 49.4, 1.6, 0.55],
];

function rejected(x: number, z: number): boolean {
  if (coastDist(x, z) > 47) return true;
  if (ROAD_RECTS.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) return true;
  // river band (spline z 0-6 across the island, generous pad)
  if (z > -1 && z < 7.5) return true;
  for (const b of BUILDING_FOOTPRINTS) {
    if (Math.hypot(x - b.x, z - b.z) < b.radius * 1.4) return true;
  }
  return false;
}

function firstGeometry(scene: THREE.Group): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry | null = null;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!geo && (o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    }
  });
  return geo!;
}

export default function GrassTufts() {
  const g0 = useGLTF(VARIANTS[0]);
  const g1 = useGLTF(VARIANTS[1]);
  const g2 = useGLTF(VARIANTS[2]);

  const meshes = useMemo(() => {
    const geos = [firstGeometry(g0.scene), firstGeometry(g1.scene), firstGeometry(g2.scene)];
    // Basic material: unlit tufts read the same at this size and skip
    // per-fragment lighting + env sampling across 90 instances.
    const mat = new THREE.MeshBasicMaterial({
      color: "#5E9C34",
      side: THREE.DoubleSide,
      alphaTest: 0.4,
    });
    const rnd = mulberry32(52801);
    const buckets: { x: number; z: number; rot: number; s: number }[][] = [[], [], []];
    let placed = 0;
    let guard = 0;
    while (placed < COUNT && guard < COUNT * 30) {
      guard++;
      const x = (rnd() - 0.5) * 96;
      const z = (rnd() - 0.5) * 96;
      if (rejected(x, z)) continue;
      buckets[Math.floor(rnd() * 3)].push({ x, z, rot: rnd() * Math.PI * 2, s: 0.38 + rnd() * 0.22 }); // knee-high was towering over the sprite
      placed++;
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    return buckets.map((list, vi) => {
      const im = new THREE.InstancedMesh(geos[vi], mat, Math.max(list.length, 1));
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot);
        p.set(t.x, getTerrainHeight(t.x, t.z), t.z);
        sc.setScalar(SCALE * t.s);
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
      });
      im.count = list.length;
      im.instanceMatrix.needsUpdate = true;
      return im;
    });
  }, [g0.scene, g1.scene, g2.scene]);

  // Dune grass: one extra InstancedMesh, drier color, on the sand band.
  const duneMesh = useMemo(() => {
    const geo = firstGeometry(g0.scene);
    const mat = new THREE.MeshBasicMaterial({
      color: "#9AA653",
      side: THREE.DoubleSide,
      alphaTest: 0.4,
    });
    const im = new THREE.InstancedMesh(geo, mat, DUNE_SPOTS.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    DUNE_SPOTS.forEach(([a, e, rot, s], i) => {
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      const r = e + coastWobble(ux, uz);
      const x = ux * r;
      const z = uz * r;
      q.setFromAxisAngle(up, rot);
      p.set(x, getTerrainHeight(x, z) - rimSink(e), z);
      sc.setScalar(SCALE * s);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    return im;
  }, [g0.scene]);

  return (
    <group>
      <primitive object={duneMesh} />
      {meshes.map((im, i) => (
        <primitive key={i} object={im} />
      ))}
    </group>
  );
}
