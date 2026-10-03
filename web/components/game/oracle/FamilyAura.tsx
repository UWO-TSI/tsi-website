"use client";

/**
 * Cosmetic family aura (row 206): a few glowing motes drifting around the
 * player in the family colour. Reuses the firefly system's path
 * (fireflyPath.ts) and glow sprite (AmbientLife fireflies).
 *
 * One draw for all seven motes (multiplayer §5.6: up to 8 of these at once, one
 * per player nearby): sprite-like points in the glow texture, each mote's own
 * fade in its colour's alpha, sized from the lens every frame so a mote is the
 * same 0.22 u across as the sprite it replaces. Nothing allocated per frame.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { fireflyOffsetInto } from "@/lib/game/fireflyPath";

const MOTES = 7;
/** A mote's width in world units (the sprites' scale). */
const SIZE = 0.22;
const at: [number, number, number] = [0, 0, 0];

/**
 * The motes this frame (module scope: the react compiler forbids writing through hook values), round the player: the
 * points sit at the player, so they sort among the scene's see-through things where the sprites did.
 */
export function placeMotes(points: THREE.Points, pos: THREE.BufferAttribute, col: THREE.BufferAttribute, material: THREE.PointsMaterial, p: THREE.Vector3, t: number, camera: THREE.Camera) {
  const a = pos.array as Float32Array, c = col.array as Float32Array;
  points.position.copy(p);
  for (let i = 0; i < MOTES; i++) {
    fireflyOffsetInto(i + 41, t * 1.4, at);
    a[i * 3] = at[0] * 0.75; a[i * 3 + 1] = 0.15 + at[1] * 1.1; a[i * 3 + 2] = at[2] * 0.75;
    c[i * 4 + 3] = 0.7 + Math.sin(t * 2 + i * 1.7) * 0.25;
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  // A point's size is in pixels per unit of depth (three's sizeAttenuation): a sprite's width there is its size times
  // the projection's y scale, so this keeps them the same at any lens (the FOV widens with speed).
  material.size = SIZE * camera.projectionMatrix.elements[5];
}

export default function FamilyAura({ player, color }: { player: React.RefObject<THREE.Vector3>; color: string }) {
  const glow = useTexture("/assets/sky/sun.png");
  const d = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.BufferAttribute(new Float32Array(MOTES * 4).fill(1), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", pos);
    geometry.setAttribute("color", col);
    const material = new THREE.PointsMaterial({ map: glow, color, size: SIZE, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return { points, pos, col, geometry, material };
  }, [glow, color]);
  useEffect(() => () => { d.geometry.dispose(); d.material.dispose(); }, [d]);
  useFrame(({ clock, camera }) => placeMotes(d.points, d.pos, d.col, d.material, player.current, clock.elapsedTime, camera));
  return <primitive object={d.points} />;
}
