"use client";

/**
 * S7Pockets (GEO S7, 2026-07-25) — two quiet-region pockets, David-ruled:
 *
 *  - The Reedmarsh: a wetland meadow on the south bank of the river's west
 *    run (x −44..−33). Two shallow ponds on flatten slabs (terrain.ts
 *    POND entries in BUILDING_FOOTPRINTS), ringed by stretched reed tufts,
 *    procedural cattails, and tall meadow grass.
 *  - The Flats: the broad tidal-sand fishery on the SE coast bulge beyond
 *    Beach Cove. Tide pools, wet-sand patches, shell/sea-star scatter;
 *    three sea cast spots live in GameWorld's FISHING_SPOTS.
 *
 * Both reuse the grass-tuft instancing trick from RiverBanks (one GLB
 * geometry, one InstancedMesh per tint). Cozy ACNH restraint throughout.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLBProp } from "./NatureModels";
import { getTerrainHeight } from "./terrain";
import { rimSink, coastDist } from "@/lib/game/coast";

const TUFT = "/assets/acnh/props/grass-tuft-01.glb";
const STUMP = "/assets/acnh/plants/stump.glb";
const ROCK_D = "/assets/acnh/props/rock-d.glb";
const SHELLS = ["scallop", "turban", "whelk", "asari"].map((k) => `/assets/acnh/props/shell-${k}.glb`);
const SEA_STAR = "/assets/acnh/sea/sea-star.glb";
[TUFT, STUMP, ROCK_D, ...SHELLS, SEA_STAR].forEach((u) => useGLTF.preload(u));
const TUFT_SCALE = 0.1;

// Visible ground (matches BeachCove): terrain minus the beach rim sink.
function groundY(x: number, z: number): number {
  return getTerrainHeight(x, z) - rimSink(coastDist(x, z));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

// Ponds (flatten slabs live in terrain.ts BUILDING_FOOTPRINTS — keep in sync)
const PONDS: { x: number; z: number; r: number }[] = [
  { x: -43, z: 9, r: 2.0 },
  { x: -38.3, z: 11.2, r: 1.4 },
];

function TuftPatch({ spots, color, stretch }: {
  spots: { x: number; z: number; rot: number; s: number }[];
  color: string;
  stretch: number;
}) {
  const tuft = useGLTF(TUFT);
  const mesh = useMemo(() => {
    const geo = firstGeometry(tuft.scene);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, alphaTest: 0.4 });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(spots.length, 1));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach((r, i) => {
      q.setFromAxisAngle(up, r.rot);
      m4.compose(
        new THREE.Vector3(r.x, groundY(r.x, r.z), r.z),
        q,
        new THREE.Vector3(TUFT_SCALE * r.s, TUFT_SCALE * r.s * stretch, TUFT_SCALE * r.s)
      );
      im.setMatrixAt(i, m4);
    });
    im.count = spots.length;
    im.instanceMatrix.needsUpdate = true;
    return im;
  }, [tuft.scene, spots, color, stretch]);
  return <primitive object={mesh} />;
}

function Reedmarsh() {
  const { reeds, meadow, cattails } = useMemo(() => {
    const rnd = mulberry32(70707);
    const reeds: { x: number; z: number; rot: number; s: number }[] = [];
    const meadow: typeof reeds = [];
    const cattails: { x: number; z: number; rot: number; lean: number }[] = [];
    // reeds ring the ponds
    for (const p of PONDS) {
      const n = Math.round(p.r * 7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
        const rr = p.r + 0.35 + rnd() * 0.7;
        reeds.push({ x: p.x + Math.cos(a) * rr, z: p.z + Math.sin(a) * rr, rot: rnd() * Math.PI * 2, s: 0.5 + rnd() * 0.3 });
        if (rnd() < 0.3) {
          cattails.push({ x: p.x + Math.cos(a) * (rr + 0.25), z: p.z + Math.sin(a) * (rr + 0.25), rot: rnd() * Math.PI * 2, lean: (rnd() - 0.5) * 0.2 });
        }
      }
    }
    // tall meadow grass scattered through the pocket
    for (let i = 0; i < 26; i++) {
      meadow.push({ x: -47 + rnd() * 11, z: 6.5 + rnd() * 7, rot: rnd() * Math.PI * 2, s: 0.55 + rnd() * 0.35 });
    }
    return { reeds, meadow, cattails };
  }, []);

  return (
    <group>
      {/* ponds: mud saucer + still water */}
      {PONDS.map((p, i) => {
        const y = getTerrainHeight(p.x, p.z);
        return (
          <group key={i}>
            <mesh position={[p.x, y + 0.012, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[p.r + 0.24, 26]} />
              <meshStandardMaterial color="#7A6A50" roughness={0.97} />
            </mesh>
            <mesh position={[p.x, y + 0.045, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[p.r, 26]} />
              <meshStandardMaterial color="#7FB5C9" roughness={0.25} transparent opacity={0.88} />
            </mesh>
          </group>
        );
      })}
      <TuftPatch spots={reeds} color="#7C8B47" stretch={1.85} />
      <TuftPatch spots={meadow} color="#8FA653" stretch={1.25} />
      {/* procedural cattails: stem + brown head */}
      {cattails.map((c, i) => {
        const y = getTerrainHeight(c.x, c.z);
        return (
          <group key={i} position={[c.x, y, c.z]} rotation={[c.lean, c.rot, c.lean]}>
            <mesh position={[0, 0.55, 0]}>
              <cylinderGeometry args={[0.022, 0.03, 1.1, 5]} />
              <meshStandardMaterial color="#6E7D3C" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.14, 0]}>
              <capsuleGeometry args={[0.075, 0.24, 3, 8]} />
              <meshStandardMaterial color="#6B4A2E" roughness={0.92} />
            </mesh>
          </group>
        );
      })}
      <GLBProp url={STUMP} position={[-45.6, getTerrainHeight(-45.6, 12.0), 12.0]} rotation={[0, 1.2, 0]} scale={1.0} castShadow={false} />
      <GLBProp url={ROCK_D} position={[-36.4, getTerrainHeight(-36.4, 7.4), 7.4]} rotation={[0, 2.8, 0]} scale={0.9} castShadow={false} />
    </group>
  );
}

// Tide pools on the Flats (terrain is falloff-flat out there — no slabs needed)
const POOLS: { x: number; z: number; r: number }[] = [
  { x: 37.5, z: 50.5, r: 1.8 },
  { x: 42.5, z: 46.5, r: 1.3 },
];

function TheFlats() {
  const shells = useMemo(() => {
    const rnd = mulberry32(424242);
    return Array.from({ length: 7 }, (_, i) => ({
      url: SHELLS[i % SHELLS.length],
      x: 32 + rnd() * 13,
      z: 44 + rnd() * 8,
      rot: rnd() * Math.PI * 2,
      s: 0.8 + rnd() * 0.4,
    }));
  }, []);

  return (
    <group>
      {POOLS.map((p, i) => {
        const y = groundY(p.x, p.z);
        // Tilt each pool to the local beach slope so the disc doesn't
        // knife into the sand (the flats slope gently seaward).
        const e = 0.8;
        const hx = (groundY(p.x + e, p.z) - groundY(p.x - e, p.z)) / (2 * e);
        const hz = (groundY(p.x, p.z + e) - groundY(p.x, p.z - e)) / (2 * e);
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(-hx, 1, -hz).normalize()
        );
        return (
          <group key={i}>
            {/* wet-sand halo, then the pool */}
            <mesh position={[p.x, y + 0.012, p.z]} quaternion={q}>
              <circleGeometry args={[p.r + 0.9, 24]} />
              <meshStandardMaterial color="#D6BE8C" roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[p.x, y + 0.045, p.z]} quaternion={q}>
              <circleGeometry args={[p.r, 24]} />
              <meshStandardMaterial color="#8FC4D4" roughness={0.2} transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {shells.map((sh, i) => (
        <GLBProp key={i} url={sh.url} position={[sh.x, groundY(sh.x, sh.z) + 0.01, sh.z]} rotation={[0, sh.rot, 0]} scale={sh.s} castShadow={false} />
      ))}
      {/* a stranded sea star by the big pool — the tide left it behind */}
      <GLBProp url={SEA_STAR} position={[39.2, groundY(39.2, 51.4) + 0.02, 51.4]} rotation={[0, 0.8, 0]} scale={0.5} castShadow={false} />
    </group>
  );
}

export default function S7Pockets() {
  return (
    <group>
      <Reedmarsh />
      <TheFlats />
    </group>
  );
}
