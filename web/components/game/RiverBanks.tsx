"use client";

/**
 * RiverBanks (organic loop, iteration 10) — the river was the last bare
 * waterway: rocks and dry reeds now dress its banks.
 *
 * Samples the river spline (River.tsx helpers), offsets perpendicular to
 * the tangent past the water edge, and drops small ACNH rocks + reed
 * tufts on the bank slopes. Deterministic (seeded), static, skips the
 * bridge crossing and the two mouths. Rocks: InstancedGLB per model;
 * reeds: one InstancedMesh of the tuft geometry in a reedy color.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import InstancedGLB, { type NaturePlacement } from "./InstancedNature";
import { getTerrainHeight } from "./terrain";
import { sampleRiverPoint, findRiverTForX } from "./River";
import { riverWidthScale } from "./terrain";

const ROCKS = ["a", "c", "e"].map((k) => `/assets/acnh/props/rock-${k}.glb`);
const TUFT = "/assets/acnh/props/grass-tuft-01.glb";
ROCKS.forEach((u) => useGLTF.preload(u));
useGLTF.preload(TUFT);

const HALF_WIDTH = 1.9; // river water half-width
const TUFT_SCALE = 0.1; // GrassTufts convention: raw GLB × 0.1 × per-instance

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BankSpot {
  x: number;
  z: number;
  rot: number;
  s: number;
}

function buildBankSpots(): { rocks: BankSpot[]; reeds: BankSpot[] } {
  const rocks: BankSpot[] = [];
  const reeds: BankSpot[] = [];
  const rnd = mulberry32(90210);
  const tBridge = findRiverTForX(0);
  for (let i = 0; i < 26; i++) {
    const t = 0.06 + (i / 25) * 0.88;
    if (Math.abs(t - tBridge) < 0.07) continue; // bridge owns the crossing
    const { position, tangent } = sampleRiverPoint(t);
    if (Math.abs(position.x) > 44) continue; // mouths stay clear
    const side = rnd() < 0.5 ? 1 : -1;
    const nx = -tangent.z * side;
    const nz = tangent.x * side;
    const off = HALF_WIDTH * riverWidthScale(position.x) + 0.5 + rnd() * 0.9;
    const x = position.x + nx * off;
    const z = position.z + nz * off;
    const spot = { x, z, rot: rnd() * Math.PI * 2, s: 0 };
    if (rnd() < 0.42) {
      rocks.push({ ...spot, s: 0.45 + rnd() * 0.35 });
    } else {
      reeds.push({ ...spot, s: 0.45 + rnd() * 0.25 });
    }
  }
  return { rocks, reeds };
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

export default function RiverBanks() {
  const tuft = useGLTF(TUFT);
  const { rocks, reeds } = useMemo(() => buildBankSpots(), []);

  const rockGroups = useMemo<NaturePlacement[][]>(() => {
    const groups: NaturePlacement[][] = ROCKS.map(() => []);
    rocks.forEach((r, i) => {
      groups[i % ROCKS.length].push({
        position: [r.x, getTerrainHeight(r.x, r.z), r.z],
        rotation: r.rot,
        scale: r.s,
      });
    });
    return groups;
  }, [rocks]);

  const reedMesh = useMemo(() => {
    const geo = firstGeometry(tuft.scene);
    const mat = new THREE.MeshBasicMaterial({
      color: "#7C8B47",
      side: THREE.DoubleSide,
      alphaTest: 0.4,
    });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(reeds.length, 1));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    reeds.forEach((r, i) => {
      q.setFromAxisAngle(up, r.rot);
      p.set(r.x, getTerrainHeight(r.x, r.z), r.z);
      // reeds stretch taller than meadow tufts — riverside rushes
      sc.set(TUFT_SCALE * r.s, TUFT_SCALE * r.s * 1.65, TUFT_SCALE * r.s);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.count = reeds.length;
    im.instanceMatrix.needsUpdate = true;
    return im;
  }, [tuft.scene, reeds]);

  return (
    <group>
      {ROCKS.map((url, i) =>
        rockGroups[i].length ? (
          <InstancedGLB key={url} url={url} placements={rockGroups[i]} castShadow={false} />
        ) : null
      )}
      <primitive object={reedMesh} />
    </group>
  );
}
