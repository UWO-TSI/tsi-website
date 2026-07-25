"use client";

/**
 * TempleRise (GEO S6, 2026-07-25) — cliff dressing for the Oracle hill.
 *
 * terrain.ts owns the walkable shape (templeRiseHeight: flat plateau +
 * stair ramp). This component sells the "big-rock cliff" read David ruled:
 *   - an InstancedMesh band of faceted stone slabs ringing the plateau
 *     edge (gap at the south stair notch),
 *   - chunky stone steps laid over the smooth ramp,
 *   - oversized dump rocks anchoring the stair mouth and the back face.
 * One instanced draw + a handful of props — cozy ACNH restraint.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLBProp } from "./NatureModels";
import { TEMPLE_RISE, TEMPLE_STAIRS, templeRiseHeight } from "./terrain";

const ROCK_A = "/assets/acnh/props/rock-a.glb";
const ROCK_C = "/assets/acnh/props/rock-c.glb";
const ROCK_E = "/assets/acnh/props/rock-e.glb";
[ROCK_A, ROCK_C, ROCK_E].forEach((u) => useGLTF.preload(u));

const SEGS = 52;
const STONE = "#8F877A"; // warm cliff stone under the grass top

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function CliffBand() {
  const { geometry, material, matrices } = useMemo(() => {
    const rnd = mulberry32(31415);
    const R = TEMPLE_RISE;
    const mats: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    for (let i = 0; i < SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const wx = R.x + Math.cos(a) * (R.topR + 0.6 + rnd() * 0.18);
      const wz = R.z + Math.sin(a) * (R.topR + 0.6 + rnd() * 0.18);
      // south stair gap: skip slabs in front of the notch
      if (Math.abs(wx - R.x) < TEMPLE_STAIRS.halfW + 0.7 && wz < R.z - R.topR + 1.6) continue;
      const h = 2.1 + rnd() * 0.7;
      eu.set((rnd() - 0.5) * 0.14, a + Math.PI / 2 + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.12);
      q.setFromEuler(eu);
      m.compose(
        new THREE.Vector3(wx, h / 2 - 0.25, wz),
        q,
        new THREE.Vector3(1.35 + rnd() * 0.45, h, 0.7 + rnd() * 0.3)
      );
      mats.push(m.clone());
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.96, flatShading: true });
    return { geometry: geo, material: mat, matrices: mats };
  }, []);

  return (
    <instancedMesh
      args={[geometry, material, matrices.length]}
      ref={(mesh) => {
        if (!mesh) return;
        matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
        mesh.instanceMatrix.needsUpdate = true;
      }}
      castShadow
      receiveShadow
    />
  );
}

function Stairs() {
  // Chunky stone steps tracking the smooth terrain ramp: each step's top
  // sits a hair above the ramp height at its center.
  const steps = useMemo(() => {
    const out: { z: number; y: number; h: number }[] = [];
    const n = 8;
    const { z0, z1 } = TEMPLE_STAIRS;
    for (let i = 0; i < n; i++) {
      const zc = z0 + ((i + 0.5) / n) * (z1 - z0);
      const y = templeRiseHeight(0, zc) ?? 0;
      out.push({ z: zc, y, h: 0.34 });
    }
    return out;
  }, []);
  return (
    <group>
      {steps.map((st, i) => (
        <mesh key={i} position={[TEMPLE_RISE.x, st.y - st.h / 2 + 0.04, st.z]} receiveShadow>
          <boxGeometry args={[3.1, st.h, 0.42]} />
          <meshStandardMaterial color="#A79E8E" roughness={0.94} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// Door braziers (wake 63): a warm flame pair flanking the temple entrance
// on the plateau. Lights breathe at dusk/night, sleep by day.
function Braziers({ phase }: { phase: "dawn" | "day" | "dusk" | "night" }) {
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const flameRefs = useRef<(THREE.Mesh | null)[]>([]);
  const XS = [-2.1, 2.1];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const base = phase === "night" ? 3.2 : phase === "dusk" ? 1.8 : 0;
    XS.forEach((_, i) => {
      const flick = 1 + Math.sin(t * 7.3 + i * 2.6) * 0.14 + Math.sin(t * 13.7 + i) * 0.07;
      const l = lightRefs.current[i];
      if (l) l.intensity = base * flick;
      const f = flameRefs.current[i];
      if (f) {
        (f.material as THREE.MeshBasicMaterial).opacity = base > 0 ? 0.85 * flick : 0;
        f.scale.setScalar(0.9 + flick * 0.1);
      }
    });
  });
  return (
    <group>
      {XS.map((x, i) => (
        <group key={i} position={[TEMPLE_RISE.x + x, TEMPLE_RISE.h, 29.2]}>
          {/* stone bowl on a squat plinth */}
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.44, 8]} />
            <meshStandardMaterial color="#8F877A" roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.26, 0.18, 0.16, 8]} />
            <meshStandardMaterial color="#7E766A" roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, 0.66, 0]} ref={(el) => { flameRefs.current[i] = el; }}>
            <coneGeometry args={[0.12, 0.3, 6]} />
            <meshBasicMaterial color="#FFB454" transparent opacity={0} depthWrite={false} />
          </mesh>
          <pointLight
            ref={(el) => { lightRefs.current[i] = el; }}
            color="#FFAE5E"
            intensity={0}
            distance={7}
            position={[0, 0.8, 0]}
          />
        </group>
      ))}
    </group>
  );
}

export default function TempleRise({ phase = "day" }: { phase?: "dawn" | "day" | "dusk" | "night" }) {
  const R = TEMPLE_RISE;
  return (
    <group>
      <CliffBand />
      <Stairs />
      <Braziers phase={phase} />
      {/* big rocks anchor the stair mouth + the back face (David: big-rock cliffs) */}
      <GLBProp url={ROCK_A} position={[R.x - 2.9, 0.02, R.z - R.topR + 0.2]} rotation={[0, 0.6, 0]} scale={1.9} />
      <GLBProp url={ROCK_C} position={[R.x + 2.9, 0.05, R.z - R.topR + 0.4]} rotation={[0, 2.3, 0]} scale={1.7} />
      <GLBProp url={ROCK_E} position={[R.x - 5.4, 0.0, R.z + 6.9]} rotation={[0, 4.1, 0]} scale={2.1} />
      <GLBProp url={ROCK_A} position={[R.x + 5.8, 0.0, R.z + 6.4]} rotation={[0, 5.2, 0]} scale={1.6} />
    </group>
  );
}
