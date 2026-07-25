"use client";

/**
 * ShoreLife (2026-07-13) — buoys and Kapp'n's boat riding the swell just
 * past the shoreline (gentle seeded bob + tilt — the only animated
 * transforms, all refs). The plaza campfire lives in AmbientProps (it
 * predates this file; a duplicate briefly shipped here — removed).
 *
 * Beach Cove wave (2026-07-14): each buoy became a CHAIN — main float,
 * an 8u rope-net span (Terrain/buoy-main/buoy-rope, the ACNH swim-border
 * net), and a smaller partner float at the far end. Floats bob
 * independently; the net stays put with its top line just above the
 * swell so it reads as a taut rope between them.
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const BUOY_URL = "/assets/acnh/props/buoy.glb";
const BOAT_URL = "/assets/acnh/props/boat.glb";
const ROPE_URL = "/assets/acnh/props/buoy-rope.glb";
useGLTF.preload(BUOY_URL);
useGLTF.preload(BOAT_URL);
useGLTF.preload(ROPE_URL);

const BUOYS: { x: number; z: number; phase: number }[] = [
  { x: -38, z: -46, phase: 0.0 },
  { x: 52, z: -34, phase: 2.1 },
  { x: 10, z: 60, phase: 4.2 },
];
const OCEAN_Y = -0.55;
const ROPE_LEN = 8; // baked world-length of the rope-net span
// The net is 1.56u tall with its base at y≈0; drop it so the top rope
// line floats 0.13u above the ocean surface and the mesh hangs below.
const ROPE_DROP = OCEAN_Y + 0.13 - 1.49;

interface Chain {
  main: [number, number];
  partner: [number, number];
  ropePos: [number, number, number];
  ropeRotY: number;
  phase: number;
}

function buildChains(): Chain[] {
  return BUOYS.map((b) => {
    const d = Math.hypot(b.x, b.z);
    // tangent to the island circle — chains run along the shore
    const tx = -b.z / d;
    const tz = b.x / d;
    const px = b.x + tx * (ROPE_LEN + 0.3);
    const pz = b.z + tz * (ROPE_LEN + 0.3);
    return {
      main: [b.x, b.z],
      partner: [px, pz],
      ropePos: [b.x + tx * (ROPE_LEN / 2 + 0.15), ROPE_DROP, b.z + tz * (ROPE_LEN / 2 + 0.15)],
      ropeRotY: -Math.atan2(tz, tx),
      phase: b.phase,
    };
  });
}

function Buoy({
  x,
  z,
  scale = 0.1,
  groupRef,
}: {
  x: number;
  z: number;
  scale?: number;
  groupRef: (el: THREE.Group | null) => void;
}) {
  const { scene } = useGLTF(BUOY_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group ref={groupRef} position={[x, OCEAN_Y, z]}>
      <primitive object={clone} scale={[scale, scale, scale]} />
    </group>
  );
}

function RopeNet({ chain }: { chain: Chain }) {
  const { scene } = useGLTF(ROPE_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={chain.ropePos} rotation={[0, chain.ropeRotY, 0]}>
      <primitive object={clone} />
    </group>
  );
}

function Boat({ groupRef }: { groupRef: (el: THREE.Group | null) => void }) {
  const { scene } = useGLTF(BOAT_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group ref={groupRef} position={[52.8, OCEAN_Y - 0.1, -51.6]} rotation={[0, -Math.PI / 3, 0]}>
      <primitive object={clone} scale={[0.1, 0.1, 0.1]} />
    </group>
  );
}

export default function ShoreLife() {
  const buoyRefs = useRef<(THREE.Group | null)[]>([]);
  const partnerRefs = useRef<(THREE.Group | null)[]>([]);
  const boatRef = useRef<THREE.Group | null>(null);
  const chains = useMemo(() => buildChains(), []);

  useFrame(() => {
    const t = performance.now() / 1000;
    chains.forEach((c, i) => {
      const g = buoyRefs.current[i];
      if (g) {
        g.position.y = OCEAN_Y + Math.sin(t * 0.9 + c.phase) * 0.12;
        g.rotation.x = Math.sin(t * 0.7 + c.phase) * 0.07;
        g.rotation.z = Math.cos(t * 0.55 + c.phase * 1.3) * 0.07;
      }
      const p = partnerRefs.current[i];
      if (p) {
        p.position.y = OCEAN_Y + Math.sin(t * 0.9 + c.phase + 1.4) * 0.1;
        p.rotation.x = Math.sin(t * 0.7 + c.phase + 0.8) * 0.06;
        p.rotation.z = Math.cos(t * 0.55 + c.phase * 1.3 + 0.5) * 0.06;
      }
    });
    const boat = boatRef.current;
    if (boat) {
      boat.position.y = OCEAN_Y - 0.1 + Math.sin(t * 0.55 + 1.2) * 0.09;
      boat.rotation.z = Math.sin(t * 0.42) * 0.035;
      boat.rotation.x = Math.cos(t * 0.35 + 0.7) * 0.028;
    }
  });

  return (
    <Suspense fallback={null}>
      {chains.map((c, i) => (
        <group key={i}>
          <Buoy x={c.main[0]} z={c.main[1]} groupRef={(el) => { buoyRefs.current[i] = el; }} />
          <Buoy
            x={c.partner[0]}
            z={c.partner[1]}
            scale={0.07}
            groupRef={(el) => { partnerRefs.current[i] = el; }}
          />
          <RopeNet chain={c} />
        </group>
      ))}
      <Boat groupRef={(el) => { boatRef.current = el; }} />
    </Suspense>
  );
}
