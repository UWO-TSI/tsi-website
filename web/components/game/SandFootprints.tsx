"use client";

/**
 * SandFootprints (organic-coast loop, iteration 8) — ACNH beach feel:
 * walking on the sand band leaves a trail of small dark prints that
 * shrink away after a few seconds.
 *
 * One InstancedMesh ring buffer (28 prints, 1 draw call). Prints spawn
 * only while the player is on the beach (coast-space 48.3..51.2), every
 * 0.55u of travel, alternating a small left/right offset perpendicular
 * to the heading. Aging shrinks the print to zero — no per-instance
 * alpha needed. Zero per-frame allocation: module scratch objects, ring
 * state in refs initialized inside useFrame (react-compiler ladder).
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { coastDist } from "@/lib/game/coast";

const POOL = 28;
const LIFE = 5; // seconds until a print fades out
const STEP_DIST = 0.55;
const BASE_SCALE = 0.115;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _spin = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

let _printMat: THREE.MeshBasicMaterial | null = null;
function getPrintMaterial(): THREE.MeshBasicMaterial {
  if (!_printMat) {
    _printMat = new THREE.MeshBasicMaterial({
      color: "#B99C6E",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
  }
  return _printMat;
}

interface PrintState {
  ages: Float32Array; // >= LIFE means free slot
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  rot: Float32Array;
  head: number;
  lastX: number;
  lastZ: number;
  side: number;
}

export default function SandFootprints({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const stateRef = useRef<PrintState | null>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let st = stateRef.current;
    if (!st) {
      st = stateRef.current = {
        ages: new Float32Array(POOL).fill(LIFE),
        x: new Float32Array(POOL),
        y: new Float32Array(POOL),
        z: new Float32Array(POOL),
        rot: new Float32Array(POOL),
        head: 0,
        lastX: playerPosRef.current.x,
        lastZ: playerPosRef.current.z,
        side: 1,
      };
    }
    const pp = playerPosRef.current;
    const dx = pp.x - st.lastX;
    const dz = pp.z - st.lastZ;
    const moved = Math.hypot(dx, dz);
    if (moved > STEP_DIST) {
      const e = coastDist(pp.x, pp.z);
      if (e > 48.3 && e < 51.2) {
        const heading = Math.atan2(dx, dz);
        // perpendicular offset alternates left/right per step
        const px = Math.cos(heading) * 0.09 * st.side;
        const pz = -Math.sin(heading) * 0.09 * st.side;
        const i = st.head;
        st.ages[i] = 0;
        st.x[i] = pp.x + px;
        st.y[i] = pp.y + 0.02;
        st.z[i] = pp.z + pz;
        st.rot[i] = heading;
        st.head = (i + 1) % POOL;
        st.side = -st.side;
      }
      st.lastX = pp.x;
      st.lastZ = pp.z;
    }

    for (let i = 0; i < POOL; i++) {
      if (st.ages[i] < LIFE) st.ages[i] += delta;
      const t = Math.min(st.ages[i] / LIFE, 1);
      const sc = t >= 1 ? 0 : BASE_SCALE * (1 - t * t);
      _spin.setFromAxisAngle(_yAxis, st.rot[i]);
      _q.multiplyQuaternions(_spin, _flat);
      _p.set(st.x[i], st.y[i], st.z[i]);
      _s.set(sc, sc * 1.5, sc); // slightly oval along the heading
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, POOL]}
      frustumCulled={false}
      material={getPrintMaterial()}
      renderOrder={1}
    >
      <circleGeometry args={[1, 10]} />
    </instancedMesh>
  );
}
