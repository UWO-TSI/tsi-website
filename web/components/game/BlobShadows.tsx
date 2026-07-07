"use client";

/**
 * BlobShadows (art-direction pass 2026-07-07) — New Leaf-style grounding.
 *
 * The 3DS Animal Crossings never ran real-time shadows: every object sits
 * on a soft dark disc and the eye reads it as perfectly grounded. We do the
 * same — one shared radial-gradient texture, ONE InstancedMesh for every
 * static blob in the scene (trees, bushes, buildings, props). Replaces the
 * PCF-soft shadow map pass that cost ~7 FPS on M1.
 *
 * Dynamic actors (player, NPCs) carry their own small disc using the same
 * shared texture via getBlobTexture().
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

let _tex: THREE.CanvasTexture | null = null;

/** Shared 64px radial gradient: solid-ish center, feathered edge. */
export function getBlobTexture(): THREE.CanvasTexture {
  if (_tex) return _tex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.6, "rgba(0,0,0,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _tex = new THREE.CanvasTexture(c);
  return _tex;
}

export interface BlobPlacement {
  x: number;
  y: number; // ground height at (x, z)
  z: number;
  rx: number; // radius along x
  rz: number; // radius along z
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export default function BlobShadows({ placements, opacity = 0.3 }: { placements: BlobPlacement[]; opacity?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getBlobTexture(),
        transparent: true,
        opacity,
        depthWrite: false,
        // Pull toward the camera in depth so the disc never z-fights the
        // terrain it lies on.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [opacity]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    placements.forEach((b, i) => {
      _p.set(b.x, b.y + 0.03, b.z);
      _s.set(b.rx * 2, b.rz * 2, 1);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = placements.length;
  }, [placements]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(placements.length, 1)]} material={material} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}
