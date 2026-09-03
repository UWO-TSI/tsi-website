"use client";

/**
 * PathChevrons — flat yellow chevrons on the road that light up in
 * sequence toward the destination. One instanced mesh; brightness rides
 * a per-instance color so the pulse travels without touching the
 * material. Material flags follow MoveTargetIndicator's ground-decal
 * recipe.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COLOR = new THREE.Color("#FFD166");

function chevronGeometry(): THREE.BufferGeometry {
  // A "^" pointing along +Y in shape space; rotated flat + toward +Z below.
  const s = new THREE.Shape();
  s.moveTo(-0.55, -0.35);
  s.lineTo(0, 0.25);
  s.lineTo(0.55, -0.35);
  s.lineTo(0.55, -0.02);
  s.lineTo(0, 0.6);
  s.lineTo(-0.55, -0.02);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export default function PathChevrons({
  points,
  heightAt,
  /** Direction of travel in XZ (default +Z). */
  dir = [0, 1],
}: {
  points: [number, number][];
  heightAt: (x: number, z: number) => number;
  dir?: [number, number];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => chevronGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#FFFFFF",
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const yaw = Math.atan2(dir[0], dir[1]);
    points.forEach(([x, z], i) => {
      // Lay the shape flat (its +Y becomes world +Z), then yaw toward dir.
      e.set(-Math.PI / 2, 0, -yaw, "YXZ");
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, heightAt(x, z) + 0.035, z), q, new THREE.Vector3(1.15, 1.15, 1));
      m.setMatrixAt(i, m4);
      m.setColorAt(i, COLOR);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points, heightAt, dir]);

  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < points.length; i++) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 - i * 1.1);
      tmp.copy(COLOR).multiplyScalar(0.45 + 0.55 * pulse);
      m.setColorAt(i, tmp);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return <instancedMesh ref={meshRef} args={[geometry, material, points.length]} renderOrder={2} />;
}
