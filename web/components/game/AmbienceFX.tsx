"use client";

/**
 * AmbienceFX (game-feel wave G2, 2026-07-07) — the approved ambience set:
 * drifting cloud shadows, falling leaves and mist; wind swirls on windy days (sky-ambient round 2).
 *
 * Everything here is deliberately cheap: one scrolling texture plane, a few
 * small InstancedMeshes and quads. No postprocessing, no per-frame allocations.
 *
 * Clouds, leaves, mist and swirls are world state (look spec §7, row 238): placed by
 * lib/game/worldFx.ts from world position, the world clock and the world wind,
 * never around the player. The view only culls what is far from where the
 * camera looks.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { worldTime } from "@/lib/game/worldClock";
import type { IslandPhase } from "@/lib/game/islandTime";
import {
  CLOUD_SPEED, LEAF_SLOTS, MIST_BANKS, MIST_TILE, SWIRL_NEAREST, WIND_DIR, leafAt, mistBank, swirlAge, viewFocus, windowFade,
  type LeafPose, type LeafTree, type Point3, type WorldWind,
} from "@/lib/game/worldFx";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";


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

// ─── Wind swirls (sky-ambient round 2) ───────────────────────────────────
// White curls of air on windy days (David, round 1: "less opacity and faster and better placement logics"): faint,
// quick, over the treetops, along the shore and across open ground (worldFx swirlSpots), each spot its own swirl
// now and then on the world clock (swirlAge), so every client sees the same ones; the nearest of them to where the
// camera looks are drawn, none on the lens. One instanced draw.
const SWIRL_VERT = /* glsl */ `
attribute float aU;
attribute float aSide;
attribute vec4 iSwirl;
attribute float iFade;
uniform vec2 uWind;
varying float vA;
varying float vU;
float h(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
// A run downwind, a loop up and over, and on.
vec3 path(float u, vec3 o, vec3 d, float L, float r) {
  float s = u * L, at = L * 0.5, loopLen = 6.2832 * r;
  if (s < at) return o + d * s + vec3(0.0, sin(s * 1.3) * 0.05, 0.0);
  if (s < at + loopLen) { float a = (s - at) / r; return o + d * (at + r * sin(a)) + vec3(0.0, r * (1.0 - cos(a)), 0.0); }
  return o + d * (s - loopLen) + vec3(0.0, sin(s * 1.1) * 0.04, 0.0);
}
void main() {
  float age = iSwirl.w, seed = iSwirl.x * 0.37 + iSwirl.z * 0.61;
  vec3 d = vec3(uWind.x, 0.0, uWind.y), o = iSwirl.xyz - d * 2.6;
  float L = 6.0, r = 0.26 + 0.18 * h(seed), head = age * 1.5, len = 0.36;
  float u = clamp(head - len + aU * len, 0.0, 1.0);
  vec3 p = path(u, o, d, L, r), q = path(min(u + 0.01, 1.0), o, d, L, r);
  vec3 side = normalize(cross(normalize(q - p + vec3(0.0, 1e-5, 0.0)), normalize(cameraPosition - p)));
  p += side * aSide * 0.034 * sin(aU * 3.1416);
  vA = smoothstep(0.0, 0.15, age) * smoothstep(1.0, 0.65, age) * iFade;
  vU = aU;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.y -= mv.z * mv.z * ${ACTIVE_WORLD_BEND.toFixed(6)} + mv.x * mv.x * ${ACTIVE_WORLD_BEND_SIDE.toFixed(6)};
  gl_Position = projectionMatrix * mv;
}`;
const SWIRL_FRAG = /* glsl */ `
varying float vA;
varying float vU;
// Faint, and fainter down the tail.
void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 0.42 * vA * (0.3 + 0.7 * vU)); }`;

const SWIRLS = 14, SWIRL_SEGMENTS = 32, SWIRL_VIEW = 22;
const _swirlCam = new THREE.Vector3();
/** Module scope (the react compiler forbids writing through hook values): this frame's swirls into the instances. */
function stepSwirls(geo: THREE.InstancedBufferGeometry, spots: readonly Point3[], camera: THREE.Camera, chance: number) {
  viewFocus(camera.position, camera.getWorldDirection(_dir), _focus);
  camera.getWorldPosition(_swirlCam);
  const t = worldTime(), at = geo.getAttribute("iSwirl") as THREE.InstancedBufferAttribute, fade = geo.getAttribute("iFade") as THREE.InstancedBufferAttribute;
  let n = 0;
  for (let i = 0; i < spots.length && n < SWIRLS; i++) {
    const s = spots[i], dx = s.x - _focus.x, dz = s.z - _focus.z;
    if (Math.abs(dx) > SWIRL_VIEW || Math.abs(dz) > SWIRL_VIEW) continue;
    const age = swirlAge(i, t, chance);
    if (age < 0) continue;
    const near = THREE.MathUtils.smoothstep(Math.hypot(s.x - _swirlCam.x, s.y - _swirlCam.y, s.z - _swirlCam.z), SWIRL_NEAREST, SWIRL_NEAREST + 5);
    const k = near * windowFade(dx, dz, SWIRL_VIEW * 2);
    if (k < 0.01) continue;
    at.setXYZW(n, s.x, s.y, s.z, age);
    fade.setX(n, k);
    n++;
  }
  geo.instanceCount = n;
  at.needsUpdate = true;
  fade.needsUpdate = true;
}

export function WindSwirls({ spots, wind }: { spots: readonly Point3[]; wind: WorldWind }) {
  const [geo, mat] = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), u: number[] = [], side: number[] = [], index: number[] = [];
    for (let i = 0; i <= SWIRL_SEGMENTS; i++) { u.push(i / SWIRL_SEGMENTS, i / SWIRL_SEGMENTS); side.push(-1, 1); }
    for (let i = 0; i < SWIRL_SEGMENTS; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(index);
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(u.length * 3).fill(0), 3));
    g.setAttribute("aU", new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute("iSwirl", new THREE.InstancedBufferAttribute(new Float32Array(SWIRLS * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("iFade", new THREE.InstancedBufferAttribute(new Float32Array(SWIRLS), 1).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      vertexShader: SWIRL_VERT, fragmentShader: SWIRL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uWind: { value: new THREE.Vector2(wind.x, wind.z).normalize() } },
    });
    return [g, m];
  }, [wind]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  // How many spots have a swirl at once: by the wind's strength (none in a calm).
  const chance = THREE.MathUtils.clamp((wind.speed - 1.2) / 6, 0, 0.5);
  useFrame(({ camera }) => stepSwirls(geo, spots, camera, chance));
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
