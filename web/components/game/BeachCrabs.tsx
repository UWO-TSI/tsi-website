"use client";

/**
 * BeachCrabs (organic loop, iteration 12) — little crabs scuttle on the
 * sand: pause… sideways dart… pause. Ambient only (not catchable — the
 * critter system needs collection icons; a shore-critter group is a
 * later drop). Real ACNH models: gazami + hermit crab.
 *
 * Each crab owns an anchor on the beach band and darts to random offsets
 * around it, FACING PERPENDICULAR to its travel (crabs walk sideways).
 * Zero allocation in the loop; state initialized inside useFrame per the
 * react-compiler ladder.
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { coastDist, rimSink } from "@/lib/game/coast";

const GAZAMI = "/assets/acnh/props/crab-gazami.glb";
const HERMIT = "/assets/acnh/props/crab-hermit.glb";
useGLTF.preload(GAZAMI);
useGLTF.preload(HERMIT);

// [anchorX, anchorZ, model] — cove sand + the wide NE sweep
const CRABS: [number, number, 0 | 1][] = [
  [19.8, 45.9, 0],
  [12.2, 47.2, 1],
  [41.5, -19.2, 0],
];

interface CrabState {
  x: number;
  z: number;
  tx: number;
  tz: number;
  t: number; // countdown of current action
  moving: boolean;
}

function groundAt(x: number, z: number): number {
  return getTerrainHeight(x, z) - rimSink(coastDist(x, z));
}

function Crab({ anchor, model }: { anchor: [number, number]; model: 0 | 1 }) {
  const { scene } = useGLTF(model === 0 ? GAZAMI : HERMIT);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);
  const st = useRef<CrabState | null>(null);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    let s = st.current;
    if (!s) {
      s = st.current = { x: anchor[0], z: anchor[1], tx: anchor[0], tz: anchor[1], t: 1 + Math.random() * 2, moving: false };
    }
    s.t -= delta;
    if (s.t <= 0) {
      if (s.moving) {
        // arrive → pause
        s.x = s.tx;
        s.z = s.tz;
        s.moving = false;
        s.t = 1.2 + Math.random() * 2.4;
      } else {
        // pick a new dart target near the anchor, stay on dry sand
        for (let tries = 0; tries < 4; tries++) {
          const a = Math.random() * Math.PI * 2;
          const d = 0.9 + Math.random() * 1.4;
          const nx = anchor[0] + Math.cos(a) * d;
          const nz = anchor[1] + Math.sin(a) * d;
          const e = coastDist(nx, nz);
          if (e > 48.0 && e < 50.8) {
            s.tx = nx;
            s.tz = nz;
            break;
          }
        }
        s.moving = true;
        s.t = 0.85;
      }
    }
    let px = s.x;
    let pz = s.z;
    if (s.moving) {
      const k = 1 - Math.max(s.t, 0) / 0.85; // 0→1 over the dart
      const ease = k * k * (3 - 2 * k);
      px = s.x + (s.tx - s.x) * ease;
      pz = s.z + (s.tz - s.z) * ease;
      // sideways scuttle: face perpendicular to the travel direction
      g.rotation.y = Math.atan2(s.tx - s.x, s.tz - s.z) + Math.PI / 2;
      // tiny leg-skitter bounce
      g.position.y = groundAt(px, pz) + Math.abs(Math.sin(state.clock.elapsedTime * 26)) * 0.02;
    } else {
      g.position.y = groundAt(px, pz);
    }
    g.position.x = px;
    g.position.z = pz;
  });

  return (
    <group ref={ref} position={[anchor[0], 0, anchor[1]]}>
      <primitive object={clone} />
    </group>
  );
}

export default function BeachCrabs() {
  return (
    <Suspense fallback={null}>
      {CRABS.map(([x, z, m], i) => (
        <Crab key={i} anchor={[x, z]} model={m} />
      ))}
    </Suspense>
  );
}
