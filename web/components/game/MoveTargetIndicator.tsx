"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PACK_COLS } from "@/lib/game/fx/pack";
import { markLook, stepMark, type MoveMark } from "@/lib/game/moveMark";
import { packMap, spriteQuad } from "./movement/moveFx";

/**
 * The move target (specs/polish/arrival-wharf.md deliverable 4): our painted ground marker from the particle pack
 * (art/fx/build_pack.py `marker`, breathing through its frames) where a tap sends you, lying on the ground's slope, lit
 * like the ground round it (dim under the moon, in your shadow when you stand on it; never a glow), landing soft,
 * breathing while you walk to it, pressing down as you arrive and shrinking away if you go another way
 * (lib/game/moveMark.ts). One mesh moved and faded through refs: nothing renders or allocates per tap or per frame.
 * Tap-to-walk is a touch screen's (and the applicant island's clicks); a fine pointer walks with the keys.
 */

/** Its width on the ground (world units) at rest. */
const SIZE = 1.35;
/** The painted marker's breathing frames per second. */
const FPS = 5;
const UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3(), SPIN = new THREE.Quaternion();

/** Module scope (the react compiler forbids writing through hook values): one frame of the marker. */
function drawMark(m: MoveMark | null, me: THREE.Mesh | null, look: { scale: number; opacity: number; spin: number }, material: THREE.MeshStandardMaterial, frames: THREE.BufferGeometry[], dt: number) {
  if (!m || !me) return;
  stepMark(m, dt);
  markLook(m, look);
  me.visible = look.opacity > 0.002;
  if (!me.visible) return;
  // Flat on the slope (its normal the ground's), turning slowly about it.
  me.quaternion.setFromUnitVectors(UP, N.set(m.nx, m.ny, m.nz));
  look.spin += dt * 0.45;
  me.quaternion.multiply(SPIN.setFromAxisAngle(UP, look.spin));
  me.position.set(m.x + m.nx * 0.025, m.y + m.ny * 0.025, m.z + m.nz * 0.025);
  me.scale.setScalar(SIZE * look.scale);
  material.opacity = look.opacity;
  me.geometry = frames[Math.floor((performance.now() / 1000) * FPS) % PACK_COLS];
}

export default function MoveTargetIndicator({ mark }: { mark: React.RefObject<MoveMark> }) {
  const frames = useMemo(() => Array.from({ length: PACK_COLS }, (_, f) => spriteQuad("marker", f, 1).rotateX(-Math.PI / 2)), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: "MoveTarget", map: packMap(), color: "#fff1c2", roughness: 1, metalness: 0, transparent: true, opacity: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), []);
  useEffect(() => () => { frames.forEach(g => g.dispose()); material.dispose(); }, [frames, material]);
  const mesh = useRef<THREE.Mesh>(null);
  const look = useMemo(() => ({ scale: 1, opacity: 0, spin: 0 }), []);
  useFrame((_, raw) => drawMark(mark.current, mesh.current, look, material, frames, Math.min(raw, 0.1)));
  return <mesh ref={mesh} geometry={frames[0]} material={material} visible={false} receiveShadow renderOrder={3.4} />;
}
