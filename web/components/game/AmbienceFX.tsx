"use client";

/**
 * AmbienceFX (game-feel wave G2, 2026-07-07) — the approved ambience set:
 * drifting cloud shadows, falling leaves and mist.
 *
 * Everything here is deliberately cheap: one scrolling texture plane, a few
 * small InstancedMeshes and quads. No postprocessing, no per-frame allocations.
 *
 * Clouds, leaves and mist are world state (look spec §7, row 238): placed by
 * lib/game/worldFx.ts from world position, the world clock and the world wind,
 * never around the player. The view only culls what is far from where the
 * camera looks.
 */

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { worldTime } from "@/lib/game/worldClock";
import type { IslandPhase } from "@/lib/game/islandTime";
import {
  CLOUD_SPEED, LEAF_SLOTS, MIST_BANKS, MIST_TILE, WIND_DIR, leafAt, mistBank, viewFocus, windowFade,
  type LeafPose, type LeafTree, type WorldWind,
} from "@/lib/game/worldFx";


// ─── Cloud shadows (item 20) ────────────────────────────────────────────
// A big transparent plane with a few soft dark blobs, its UVs offset by the
// world clock along the world wind — clouds drifting over the fields for one
// texture sample, in the same place on every client.
let _cloudTex: THREE.CanvasTexture | null = null;
function getCloudTexture(): THREE.CanvasTexture {
  if (_cloudTex) return _cloudTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const blob = (x: number, y: number, rx: number, ry: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.7, `rgba(0,0,0,${a * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  blob(60, 70, 46, 30, 0.85);
  blob(95, 85, 34, 24, 0.7);
  blob(190, 180, 52, 34, 0.8);
  blob(225, 160, 30, 22, 0.6);
  blob(150, 40, 26, 18, 0.55);
  _cloudTex = new THREE.CanvasTexture(c);
  _cloudTex.wrapS = _cloudTex.wrapT = THREE.RepeatWrapping;
  _cloudTex.repeat.set(2, 2);
  return _cloudTex;
}

const frac = (v: number) => v - Math.floor(v);

/** The drawn cloud layer for others (the water dims the sun under it): its texture and world (x, z) → uv, while a CloudShadows is mounted. */
export const cloudLayer = { map: null as THREE.Texture | null, uv: new THREE.Vector4() };

export function CloudShadows({ phase, size = [240, 240], bounded = false }: { phase: IslandPhase; size?: [number, number]; bounded?: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useEffect(() => () => { cloudLayer.map = null; }, []);
  useFrame((_, delta) => {
    // Module-cached texture — mutated through the getter so the compiler's
    // frozen-memo rule stays satisfied.
    const tex = getCloudTexture();
    // World drift → UV offset. The plane lies with local +y along world -z,
    // and a growing offset slides the pattern toward -u, hence the signs.
    const drift = worldTime() * CLOUD_SPEED;
    tex.offset.set(frac(-WIND_DIR.x * drift * tex.repeat.x / size[0]), frac(WIND_DIR.z * drift * tex.repeat.y / size[1]));
    // The plane's uv is (x / w + 0.5, 0.5 - z / h) (lying flat, local +y = world -z); the texture reads uv * repeat + offset.
    cloudLayer.map = tex;
    cloudLayer.uv.set(tex.repeat.x / size[0], -tex.repeat.y / size[1], tex.repeat.x * 0.5 + tex.offset.x, tex.repeat.y * 0.5 + tex.offset.y);
    if (matRef.current) {
      const target = phase === "day" ? 0.12 : phase === "night" ? 0 : 0.07;
      matRef.current.opacity = THREE.MathUtils.damp(matRef.current.opacity, target, 1.5, delta);
    }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={matRef} map={getCloudTexture()} transparent opacity={0} depthWrite={false}
        onBeforeCompile={shader => {
          if (bounded) {
            shader.vertexShader = "varying vec2 vCloudUv;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloudUv = uv;");
            shader.fragmentShader = "varying vec2 vCloudUv;\n" + shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.65, 1.0, length(vCloudUv * 2.0 - 1.0));");
          }
        }} customProgramCacheKey={() => `cloud-shade-${bounded}`} />
    </mesh>
  );
}

// ─── Leaves and petals shed by the trees (wake 65; world 2026-09-27) ──────
// Autumn leaves and spring petals fall from the actual trees on the map
// (`leafAt`): each tree drops a few from its crown on its own seeded
// schedule, they drift with the world wind, rest on the ground and fade. No
// tree nearby, no leaves. One InstancedMesh; trees far from where the camera
// looks are skipped (culled, not stopped), and only leaves in the air or on
// the ground take an instance.
const LEAF_POOL = 130;
const LEAF_VIEW = 30;
const LEAF_LOOKS = {
  leaves: { color: "#C7823A", size: 0.15, fall: 0.7, flutter: 0.35, spin: 9, opacity: 0.92 },
  petals: { color: "#F5B8CC", size: 0.11, fall: 0.55, flutter: 0.45, spin: 6, opacity: 0.9 },
};
const _fp = new THREE.Vector3();
const _fe = new THREE.Euler();
const _fq = new THREE.Quaternion();
const _fs = new THREE.Vector3();
const _fm = new THREE.Matrix4();
const _dir = new THREE.Vector3();
const _focus = { x: 0, z: 0 };
const _leaf: LeafPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 0 };

export function TreeLeaves({ trees, mode, wind, ground }: { trees: readonly LeafTree[]; mode: keyof typeof LEAF_LOOKS; wind: WorldWind; ground: (x: number, z: number) => number }) {
  const look = LEAF_LOOKS[mode];
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    viewFocus(camera.position, camera.getWorldDirection(_dir), _focus);
    const t = worldTime();
    let n = 0;
    for (let i = 0; i < trees.length && n < LEAF_POOL; i++) {
      const tree = trees[i];
      if (Math.hypot(tree.x - _focus.x, tree.z - _focus.z) > LEAF_VIEW) continue;
      for (let slot = 0; slot < LEAF_SLOTS && n < LEAF_POOL; slot++) {
        leafAt(tree, slot, t, wind, look, ground, _leaf);
        if (_leaf.scale <= 0) continue;
        _fq.setFromEuler(_fe.set(_leaf.rx, _leaf.ry, _leaf.rz));
        _fm.compose(_fp.set(_leaf.x, _leaf.y, _leaf.z), _fq, _fs.setScalar(look.size * _leaf.scale));
        mesh.setMatrixAt(n++, _fm);
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!trees.length) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, LEAF_POOL]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={look.color} transparent opacity={look.opacity} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ─── Mist banks (2026-09-24; world 2026-09-27) ───────────────────────────
// Fog-day haze that hugs the ground: large soft sprites (the existing
// sun-glow radial) tinted with the fog colour. The banks are world state
// (`mistBank`): they drift with the world wind, pool over the sea, the river
// and low ground and thin over rises. The one tile around where the camera
// looks is drawn, fading at its edge. Normal blending, no depth write.
const _bank = { x: 0, y: 0, z: 0, strength: 0 };
export function MistBanks({ color, opacity = 0.32, wind, ground }: { color: string; opacity?: number; wind: WorldWind; ground: (x: number, z: number) => number }) {
  const glow = useTexture("/assets/sky/sun.png");
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    viewFocus(camera.position, camera.getWorldDirection(_dir), _focus);
    const t = worldTime();
    for (let k = 0; k < g.children.length; k++) {
      const sprite = g.children[k] as THREE.Sprite;
      mistBank(k, t, wind, _focus.x, _focus.z, ground, _bank);
      sprite.position.set(_bank.x, _bank.y, _bank.z);
      sprite.material.opacity = opacity * _bank.strength * windowFade(_bank.x - _focus.x, _bank.z - _focus.z, MIST_TILE);
    }
  });
  return <group ref={group}>{Array.from({ length: MIST_BANKS }, (_, i) => (
    <sprite key={i} scale={[9 + (i % 3) * 2, 3.2, 1]} renderOrder={4}>
      <spriteMaterial map={glow} color={color} transparent opacity={0} depthWrite={false} fog={false} />
    </sprite>
  ))}</group>;
}
