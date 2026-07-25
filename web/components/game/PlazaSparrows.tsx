"use client";

/**
 * PlazaSparrows (loop wake 34) — the ACNH plaza-pigeon beat, sparrow-sized.
 * Three little birds peck around the brick plaza, hop to new spots, and
 * flee in a short climbing burst when the player walks up — returning a
 * while after the coast is clear. Day/dusk/dawn only (parent gates night).
 *
 * All movement lives in one useFrame writing refs — zero per-frame React.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";

// Anchors sit in the plaza corners (RoadTiles PLAZA rect is x ±5.4,
// z -16.6..-9.4) — away from the spawn point at (0,-12) so the birds
// don't flee the moment the world loads.
const ANCHORS: [number, number][] = [
  [-3.9, -15.2],
  [4.1, -14.6],
  [3.6, -10.4],
];
const PLAZA = { x0: -5.0, x1: 5.0, z0: -16.2, z1: -9.8 };
const FLEE_RADIUS = 2.6;

interface SparrowState {
  x: number;
  z: number;
  tx: number;
  tz: number;
  hopT: number; // -1 = not hopping, else 0..1 progress
  nextHopAt: number;
  mode: "ground" | "flee" | "gone" | "return";
  modeT: number;
  returnAt: number;
  fleeDir: [number, number];
}

function makeState([x, z]: [number, number], i: number): SparrowState {
  return { x, z, tx: x, tz: z, hopT: -1, nextHopAt: 1.5 + i * 0.9, mode: "ground", modeT: 0, returnAt: 0, fleeDir: [1, 0] };
}

export default function PlazaSparrows({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  // Mutable frame state lives in a ref (react-compiler: useMemo results are
  // frozen) — same pattern as FishShadows' flee state.
  const statesRef = useRef<SparrowState[]>(ANCHORS.map((a, i) => makeState(a, i)));

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const p = playerPosRef.current;
    const states = statesRef.current;
    for (let i = 0; i < states.length; i++) {
      const g = refs.current[i];
      const s = states[i];
      if (!g) continue;
      const groundY = getTerrainHeight(s.x, s.z);

      if (s.mode === "ground") {
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        if (d < FLEE_RADIUS) {
          s.mode = "flee";
          s.modeT = 0;
          const inv = d > 0.01 ? 1 / d : 1;
          s.fleeDir = [(s.x - p.x) * inv, (s.z - p.z) * inv];
        } else if (s.hopT >= 0) {
          // mid-hop: lerp to target with a little arc
          s.hopT = Math.min(1, s.hopT + dt / 0.28);
          const k = s.hopT;
          s.x += (s.tx - s.x) * k * 0.5;
          s.z += (s.tz - s.z) * k * 0.5;
          g.position.set(s.x, groundY + Math.sin(k * Math.PI) * 0.12, s.z);
          g.rotation.y = Math.atan2(s.tx - s.x, s.tz - s.z);
          if (s.hopT >= 1) {
            s.hopT = -1;
            s.nextHopAt = t + 1.4 + Math.random() * 2.2;
          }
        } else {
          // idle peck: soft head-dip wiggle
          g.position.set(s.x, groundY, s.z);
          g.rotation.x = Math.max(0, Math.sin(t * 2.6 + i * 2.1)) * 0.35;
          if (t > s.nextHopAt) {
            const nx = Math.min(PLAZA.x1, Math.max(PLAZA.x0, s.x + (Math.random() * 2 - 1) * 1.3));
            const nz = Math.min(PLAZA.z1, Math.max(PLAZA.z0, s.z + (Math.random() * 2 - 1) * 1.3));
            s.tx = nx;
            s.tz = nz;
            s.hopT = 0;
          }
        }
      } else if (s.mode === "flee") {
        s.modeT += dt;
        s.x += s.fleeDir[0] * 6 * dt;
        s.z += s.fleeDir[1] * 6 * dt;
        g.position.set(s.x, groundY + s.modeT * 3.2, s.z);
        g.rotation.y = Math.atan2(s.fleeDir[0], s.fleeDir[1]);
        g.rotation.x = -0.4;
        g.rotation.z = Math.sin(t * 22) * 0.45; // frantic flap
        if (s.modeT > 1.1) {
          s.mode = "gone";
          s.returnAt = t + 8 + Math.random() * 8;
          g.visible = false;
        }
      } else if (s.mode === "gone") {
        if (t > s.returnAt && Math.hypot(p.x - ANCHORS[i][0], p.z - ANCHORS[i][1]) > FLEE_RADIUS + 1.5) {
          const [ax, az] = ANCHORS[i];
          s.x = ax;
          s.z = az;
          s.mode = "return";
          s.modeT = 0;
          g.visible = true;
        }
      } else {
        // return: glide down onto the anchor
        s.modeT = Math.min(1, s.modeT + dt / 0.8);
        g.position.set(s.x, groundY + (1 - s.modeT) * 2.6, s.z);
        g.rotation.x = 0.25 * (1 - s.modeT);
        g.rotation.z = Math.sin(t * 14) * 0.3 * (1 - s.modeT);
        if (s.modeT >= 1) {
          s.mode = "ground";
          s.hopT = -1;
          s.nextHopAt = t + 1 + Math.random() * 1.5;
        }
      }
    }
  });

  return (
    <group>
      {ANCHORS.map(([x, z], i) => (
        <group
          key={i}
          position={[x, getTerrainHeight(x, z), z]}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {/* body */}
          <mesh position={[0, 0.07, 0]} castShadow>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color={i === 1 ? "#8A7B6B" : "#6E625A"} roughness={0.9} />
          </mesh>
          {/* head */}
          <mesh position={[0, 0.13, 0.05]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color={i === 1 ? "#9A8B7B" : "#7E726A"} roughness={0.9} />
          </mesh>
          {/* beak */}
          <mesh position={[0, 0.125, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.012, 0.035, 5]} />
            <meshStandardMaterial color="#C9962E" roughness={0.8} />
          </mesh>
          {/* tail */}
          <mesh position={[0, 0.08, -0.08]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.05, 0.015, 0.08]} />
            <meshStandardMaterial color="#5A5048" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
