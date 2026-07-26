"use client";

/**
 * FishShadows (world-life loop, 2026-07-14) — the ACNH signature: dark
 * fish silhouettes gliding under the water, tail-swaying, patrolling
 * stretches of the river plus a few in the sea shallows.
 *
 * Flat dark ellipses just under the water surface — no models, one
 * shared geometry + material, 8 meshes. River fish ping-pong through a
 * spline window with a cross-channel sway; sea fish orbit anchors in
 * the shallows. Pure ambience (catching stays in FishingOverlay).
 */

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleRiverPoint } from "./River";

// Splash-scatter (loop wake 26): when a cast plops down near a shadow, it
// darts away from the splash and swims back — ACNH's "you scared it" beat.
// One module-scope splash record; each fish decides membership ONCE per
// splash (drifting into range later doesn't spook it).
const SPLASH = { x: 0, z: 0, at: 0 };
const FLEE_RADIUS = 6;
const FLEE_DIST = 2.6;
const FLEE_MS = 2800;

interface FleeState {
  seenAt: number;
  active: boolean;
  start: number;
  dx: number;
  dz: number;
}
export function makeFleeState(): FleeState {
  return { seenAt: 0, active: false, start: 0, dx: 0, dz: 0 };
}

/** Offset for this frame + whether the fish is in its dart-out beat. */
function computeFlee(fs: FleeState, fx: number, fz: number): { ox: number; oz: number; dart: boolean } {
  if (fs.seenAt !== SPLASH.at) {
    fs.seenAt = SPLASH.at;
    const dx = fx - SPLASH.x;
    const dz = fz - SPLASH.z;
    const d = Math.hypot(dx, dz);
    if (d < FLEE_RADIUS) {
      fs.active = true;
      fs.start = performance.now();
      const inv = d > 0.01 ? 1 / d : 1;
      fs.dx = dx * inv;
      fs.dz = dz * inv;
    }
  }
  if (!fs.active) return { ox: 0, oz: 0, dart: false };
  const p = (performance.now() - fs.start) / FLEE_MS;
  if (p >= 1) {
    fs.active = false;
    return { ox: 0, oz: 0, dart: false };
  }
  // dart out fast, then drift back to the patrol line
  const out = p < 0.3 ? 1 - Math.pow(1 - p / 0.3, 3) : 1 - (p - 0.3) / 0.7;
  return { ox: fs.dx * FLEE_DIST * out, oz: fs.dz * FLEE_DIST * out, dart: p < 0.3 };
}

const RIVER_FISH: { t0: number; t1: number; speed: number; size: number; phase: number }[] = [
  { t0: 0.1, t1: 0.22, speed: 0.014, size: 0.38, phase: 0 },
  { t0: 0.3, t1: 0.44, speed: 0.011, size: 0.5, phase: 2.1 },
  { t0: 0.52, t1: 0.63, speed: 0.016, size: 0.34, phase: 4.0 },
  { t0: 0.68, t1: 0.8, speed: 0.012, size: 0.44, phase: 1.2 },
  { t0: 0.84, t1: 0.93, speed: 0.015, size: 0.36, phase: 3.3 },
];
const RIVER_FISH_Y = -0.38; // just under the -0.32 water surface

const SEA_FISH: { x: number; z: number; r: number; speed: number; size: number; phase: number }[] = [
  { x: 18.8, z: 59.8, r: 2.2, speed: 0.22, size: 0.55, phase: 0.5 },   // the cove bay (S1)
  { x: 49.3, z: -31.7, r: 2.8, speed: 0.17, size: 0.6, phase: 2.8 },   // NE sweep (S1)
  { x: -46.9, z: 39.9, r: 2.4, speed: 0.2, size: 0.5, phase: 4.4 },    // west bank (S1)
];
const SEA_FISH_Y = -0.62; // just under the -0.55 ocean surface

// Shared flat fish-ellipse: unit length along local Z, squashed in X,
// lying in XZ. rotation.y = heading works naturally.
let _fishGeo: THREE.CircleGeometry | null = null;
function getFishGeometry(): THREE.CircleGeometry {
  if (!_fishGeo) {
    _fishGeo = new THREE.CircleGeometry(1, 12);
    _fishGeo.scale(0.42, 1, 1);
    _fishGeo.rotateX(-Math.PI / 2);
  }
  return _fishGeo;
}

let _shadowMat: THREE.MeshBasicMaterial | null = null;
function getShadowMaterial(): THREE.MeshBasicMaterial {
  if (!_shadowMat) {
    _shadowMat = new THREE.MeshBasicMaterial({
      color: "#16323E",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
  }
  return _shadowMat;
}

let _ringGeo: THREE.RingGeometry | null = null;
function getRingGeometry(): THREE.RingGeometry {
  if (!_ringGeo) {
    _ringGeo = new THREE.RingGeometry(0.75, 1, 18);
    _ringGeo.rotateX(-Math.PI / 2);
  }
  return _ringGeo;
}

const JUMP_PERIOD = 22; // seconds between breaches per fish
const JUMP_LEN = 0.85;

function RiverFish({ cfg }: { cfg: (typeof RIVER_FISH)[number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const fleeRef = useRef<FleeState>(makeFleeState());
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const time = clock.elapsedTime;
    const span = cfg.t1 - cfg.t0;
    const cyc = (time * cfg.speed) / span + cfg.phase;
    const k = Math.abs((cyc % 2) - 1); // ping-pong 0..1..0
    const t = cfg.t0 + k * span;
    const { position, tangent } = sampleRiverPoint(t);
    const dir = cyc % 2 < 1 ? -1 : 1;
    const swayN = Math.sin(time * 0.7 + cfg.phase) * 0.6;
    const fx = position.x - tangent.z * swayN;
    const fz = position.z + tangent.x * swayN;
    const flee = computeFlee(fleeRef.current, fx, fz);

    // Koi breach: once per JUMP_PERIOD the shadow arcs above the surface
    // with a splash ring — the little "the water is alive" beat. Skipped
    // while spooked (a fleeing fish doesn't celebrate).
    const jt = (time + cfg.phase * 7) % JUMP_PERIOD;
    let y = RIVER_FISH_Y;
    if (jt < JUMP_LEN && !fleeRef.current.active) {
      const p = jt / JUMP_LEN; // 0..1
      y = RIVER_FISH_Y + Math.sin(p * Math.PI) * 0.42;
      m.rotation.x = Math.sin(p * Math.PI * 2) * 0.9; // flip through the arc
    } else {
      m.rotation.x = 0;
    }
    m.position.set(fx + flee.ox, y, fz + flee.oz);
    m.rotation.y = flee.dart
      ? Math.atan2(fleeRef.current.dx, fleeRef.current.dz) + Math.sin(time * 9 + cfg.phase) * 0.2
      : Math.atan2(tangent.x * dir, tangent.z * dir) + Math.sin(time * 5 + cfg.phase) * 0.14;
    m.scale.setScalar(cfg.size);

    const ring = ringRef.current;
    if (ring) {
      if (jt < 1.1) {
        const rp = jt / 1.1;
        ring.visible = true;
        ring.position.set(fx, RIVER_FISH_Y + 0.07, fz);
        ring.scale.setScalar(0.25 + rp * 1.0);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - rp);
      } else {
        ring.visible = false;
      }
    }
  });
  return (
    <group>
      <mesh ref={ref} geometry={getFishGeometry()} material={getShadowMaterial()} renderOrder={-1} />
      <mesh ref={ringRef} geometry={getRingGeometry()} visible={false} renderOrder={1}>
        <meshBasicMaterial color="#EAF7FA" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SeaFish({ cfg }: { cfg: (typeof SEA_FISH)[number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const fleeRef = useRef<FleeState>(makeFleeState());
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const time = clock.elapsedTime;
    const a = time * cfg.speed + cfg.phase;
    const fx = cfg.x + Math.cos(a) * cfg.r;
    const fz = cfg.z + Math.sin(a) * cfg.r;
    const flee = computeFlee(fleeRef.current, fx, fz);
    m.position.set(fx + flee.ox, SEA_FISH_Y, fz + flee.oz);
    // orbit tangent heading (+ wiggle): d/da of (cos,sin) is (-sin,cos)
    m.rotation.y = flee.dart
      ? Math.atan2(fleeRef.current.dx, fleeRef.current.dz) + Math.sin(time * 9 + cfg.phase) * 0.2
      : Math.atan2(-Math.sin(a), Math.cos(a)) + Math.sin(time * 4.5 + cfg.phase) * 0.15;
    m.scale.setScalar(cfg.size);
  });
  return <mesh ref={ref} geometry={getFishGeometry()} material={getShadowMaterial()} renderOrder={-1} />;
}

export default function FishShadows() {
  // The splash lands ~half a second after the cast fires (bobber flight) —
  // scatter on the plop, not the throw.
  useEffect(() => {
    const timers: number[] = [];
    const onCast = (e: Event) => {
      const d = (e as CustomEvent).detail as { x?: number; z?: number } | undefined;
      if (typeof d?.x !== "number" || typeof d?.z !== "number") return;
      timers.push(
        window.setTimeout(() => {
          SPLASH.x = d.x!;
          SPLASH.z = d.z!;
          SPLASH.at = performance.now();
        }, 480)
      );
    };
    window.addEventListener("tsi:fish-cast", onCast);
    return () => {
      window.removeEventListener("tsi:fish-cast", onCast);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);
  return (
    <group>
      {RIVER_FISH.map((cfg, i) => (
        <RiverFish key={`r${i}`} cfg={cfg} />
      ))}
      {SEA_FISH.map((cfg, i) => (
        <SeaFish key={`s${i}`} cfg={cfg} />
      ))}
    </group>
  );
}
