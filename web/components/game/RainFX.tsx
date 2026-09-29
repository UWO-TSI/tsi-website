"use client";

/**
 * RainFX (rain days v1, 2026-07-12; world field 2026-09-27, look spec §7.3) —
 * instanced rain streaks and snowflakes.
 *
 * The rain is WORLD state: `rainStreak` (lib/game/worldFx.ts) places every
 * streak from world position and world time, one 36-unit tile repeating over
 * the whole world, slanted by the world wind. This component only draws the
 * one tile around where the camera looks, so walking never drags the rain and
 * two players under the same cloud see the same streaks. One InstancedMesh +
 * one module-scope material: a single draw call, no per-frame allocation.
 * Lite mode / graphics settings gate mounting, not here.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleTerrainHeightFast } from "./terrain";
import { worldTime } from "@/lib/game/worldClock";
import { rainStreak, viewFocus, type WorldWind } from "@/lib/game/worldFx";

const COUNT = 240;

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
let _snowMat: THREE.MeshBasicMaterial | null = null;
function getSnowMaterial(): THREE.MeshBasicMaterial {
  if (!_snowMat) {
    // Round flakes from the existing soft sun-glow sprite texture.
    const flake = new THREE.TextureLoader().load("/assets/sky/sun.png");
    flake.colorSpace = THREE.SRGBColorSpace;
    _snowMat = new THREE.MeshBasicMaterial({ color: "#F4F8FC", map: flake, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  }
  return _snowMat;
}

/** Same streak field, re-tuned: slow, swaying flakes for snowfall (2026-09-24). */
const KINDS = {
  rain: { fall: 21, sway: 0, size: [0.03, 0.7] as [number, number] },
  snow: { fall: 2.1, sway: 0.6, size: [0.16, 0.16] as [number, number] },
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _pt = { x: 0, y: 0, z: 0 };
const _focus = { x: 0, z: 0 };

export default function RainFX({ wind, groundHeight = sampleTerrainHeightFast, kind = "rain" }: { wind: WorldWind; groundHeight?: (x: number, z: number) => number; kind?: keyof typeof KINDS }) {
  const look = KINDS[kind];
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    viewFocus(camera.position, camera.getWorldDirection(_dir), _focus);
    const t = worldTime();
    // Streaks lie along their velocity: the fall plus the wind.
    _q.setFromUnitVectors(_up, _v.set(-wind.x, look.fall, -wind.z).normalize());
    for (let i = 0; i < COUNT; i++) {
      rainStreak(i, t, wind, look, _focus.x, _focus.z, _pt);
      // Below the ground it has landed: not drawn until its next fall.
      _s.setScalar(_pt.y < groundHeight(_pt.x, _pt.z) ? 0 : 1);
      _m.compose(_p.set(_pt.x, _pt.y, _pt.z), _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false} material={kind === "snow" ? getSnowMaterial() : getRainMaterial()} renderOrder={5}>
      <planeGeometry args={look.size} />
    </instancedMesh>
  );
}
