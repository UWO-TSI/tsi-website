"use client";

/**
 * RainFX (rain days v1, 2026-07-12) — instanced rain streaks.
 *
 * 240 thin vertical quads falling inside a 36x18x36 box that follows the
 * player. Each streak wraps back to the top with a new seeded XZ when it
 * passes the ground. One InstancedMesh + one module-scope material: a
 * single draw call, no per-frame allocation (module scratch objects, same
 * pattern as LeafGusts in AmbienceFX).
 *
 * Deterministic layout via mulberry32 (react-compiler: no Math.random in
 * render). Lite mode / graphics settings gate mounting in GameWorld, not
 * here.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleTerrainHeightFast } from "./terrain";

const COUNT = 240;
const BOX = 36; // XZ extent around the player
const TOP = 16; // spawn height band top
const FALL_SPEED = 21;
const SLANT = 2.6; // slight wind lean, units/sec in +x

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-streak state lives in flat arrays owned by the component instance via
// refs; the material + scratch objects are module singletons.
let _rainMat: THREE.MeshBasicMaterial | null = null;
function getRainMaterial(): THREE.MeshBasicMaterial {
  if (!_rainMat) {
    _rainMat = new THREE.MeshBasicMaterial({
      color: "#AEC6DE",
      transparent: true,
      // David 2026-07-14: rain read too heavy — was 0.42.
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  return _rainMat;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.12));
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

function buildDrops(): Float32Array {
  const rnd = mulberry32(7741);
  const arr = new Float32Array(COUNT * 4); // x, y, z, speedJitter
  for (let i = 0; i < COUNT; i++) {
    arr[i * 4] = (rnd() - 0.5) * BOX;
    arr[i * 4 + 1] = rnd() * TOP;
    arr[i * 4 + 2] = (rnd() - 0.5) * BOX;
    arr[i * 4 + 3] = 0.75 + rnd() * 0.5;
  }
  return arr;
}

export default function RainFX({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Drop state lives in a ref, seeded lazily on the first frame — the
  // react-compiler freezes useMemo results, and ref writes during render
  // are equally off-limits, so the init happens inside useFrame.
  const dropsRef = useRef<Float32Array | null>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let drops = dropsRef.current;
    if (!drops) drops = dropsRef.current = buildDrops();
    const pp = playerPosRef.current;
    const d = Math.min(delta, 0.05);
    for (let i = 0; i < COUNT; i++) {
      const j = i * 4;
      drops[j + 1] -= FALL_SPEED * drops[j + 3] * d;
      drops[j] += SLANT * d;
      // wrap in XZ so the box stays centered on the player
      let lx = drops[j];
      const lz = drops[j + 2];
      if (lx > BOX / 2) { drops[j] = lx -= BOX; }
      const wx = pp.x + lx;
      const wz = pp.z + lz;
      if (drops[j + 1] < sampleTerrainHeightFast(wx, wz) - pp.y) {
        drops[j + 1] = TOP * (0.7 + 0.3 * drops[j + 3]);
      }
      _p.set(wx, pp.y + drops[j + 1], wz);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false} material={getRainMaterial()} renderOrder={5}>
      <planeGeometry args={[0.03, 0.7]} />
    </instancedMesh>
  );
}
