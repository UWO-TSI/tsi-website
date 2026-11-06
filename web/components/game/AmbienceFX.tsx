"use client";

/**
 * AmbienceFX (game-feel wave G2, 2026-07-07) — the approved ambience set:
 * drifting cloud shadows, falling leaves and mist; the wind's marks and golden hour's motes (sky-ambient round 3).
 *
 * Everything here is deliberately cheap: one scrolling texture plane, a few
 * small InstancedMeshes and quads. No postprocessing, no per-frame allocations.
 *
 * Clouds, leaves, mist, the wind's marks and the motes are world state (look spec §7, row 238): placed by
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
  CLOUD_SPEED, LEAF_SLOTS, MARK_NEAREST, MARK_SECONDS, MIST_BANKS, MIST_TILE, WIND_DIR, hash01, leafAt, mistBank, viewFocus, windowFade,
  type LeafPose, type LeafTree, type WindSpot, type WorldWind,
} from "@/lib/game/worldFx";
import { FRONT_SPEED, WIND, lastFront, stirs, type FrontPass } from "@/lib/game/wind";
import { skyUniforms } from "@/lib/game/skyShader";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";
import { SEA_LEVEL } from "@/lib/game/world/terrain";


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

// ─── The wind's marks (sky-ambient round 3) ──────────────────────────────
// David, round 2: "its so random rn and it doesnt have like any proper logic behind it, it shouldnt feel just slapped
// on, so more faint, and have different types of animation ... it should blow the same way as the wind and [last] like
// 2 second and 0.3 opacity". Each mark is stirred by a gust front (lib/game/wind.ts) as its crest crosses a spot where
// wind shows (worldFx windSpots), lives MARK_SECONDS, blows downwind with the front, and is drawn at most
// MARK_OPACITY: a streak of air gliding over open ground, a curl of it rolling over, a wisp of sand along the shore,
// a few leaves torn off a crown. Every client sees the same marks; none on the lens. Two instanced draws.
const MARK_OPACITY = 0.3;
const MARK_VERT = /* glsl */ `
attribute float aU;
attribute float aSide;
attribute vec4 iMark;
attribute vec4 iLook;
uniform vec2 uWind;
uniform float uTravel;
varying float vA;
varying float vU;
varying float vSand;
float h(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
// A curl: a run downwind, a loop up and over, and on.
vec3 curl(float s, vec3 o, vec3 d, float L, float r) {
  float at = L * 0.45, loopLen = 6.2832 * r;
  if (s < at) return o + d * s;
  if (s < at + loopLen) { float a = (s - at) / r; return o + d * (at + r * sin(a)) + vec3(0.0, r * (1.0 - cos(a)), 0.0); }
  return o + d * (s - loopLen);
}
void main() {
  float age = iMark.w, kind = iLook.x, seed = iLook.y;
  vec3 d = vec3(uWind.x, 0.0, uWind.y), side = vec3(-d.z, 0.0, d.x);
  // The stroke slides along its path as the front carries it: its head from the start to the end over its life.
  float L = uTravel * (0.8 + 0.4 * h(seed)), len = kind > 1.5 ? 0.3 : 0.38, head = age * (1.0 + len);
  float u = clamp(head - len + aU * len, 0.0, 1.0), s = u * L;
  vec3 o = iMark.xyz - d * L * 0.35, p;
  if (kind < 0.5) p = o + d * s + side * sin(s * 0.55 + seed * 6.0) * 0.22 + vec3(0.0, sin(s * 0.9 + seed) * 0.12, 0.0);
  else if (kind < 1.5) p = curl(s, o, d, L, 0.3 + 0.2 * h(seed + 1.0));
  else p = o + d * s + side * sin(s * 0.8 + seed * 5.0) * 0.35 + vec3(0.0, 0.08 * sin(s * 2.1), 0.0);
  float ahead = min(u + 0.01, 1.0) * L;
  vec3 q = kind < 1.5 && kind > 0.5 ? curl(ahead, o, d, L, 0.3 + 0.2 * h(seed + 1.0)) : o + d * ahead;
  vec3 across = normalize(cross(normalize(q - p + vec3(0.0, 1e-5, 0.0)), normalize(cameraPosition - p)));
  // A thin stroke that stays about three pixels wide however far off it is (never a flickering hair).
  p += across * aSide * (0.035 + 0.004 * distance(cameraPosition, p)) * sin(aU * 3.1416);
  vA = smoothstep(0.0, 0.2, age) * smoothstep(1.0, 0.6, age) * iLook.z;
  vU = aU;
  vSand = step(1.5, kind);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.y -= mv.z * mv.z * ${ACTIVE_WORLD_BEND.toFixed(6)} + mv.x * mv.x * ${ACTIVE_WORLD_BEND_SIDE.toFixed(6)};
  gl_Position = projectionMatrix * mv;
}`;
const MARK_FRAG = /* glsl */ `
varying float vA;
varying float vU;
varying float vSand;
// Faint, fainter down the tail; sand a warm white.
void main() { gl_FragColor = vec4(mix(vec3(1.0), vec3(1.0, 0.97, 0.9), vSand), ${MARK_OPACITY.toFixed(2)} * vA * (0.25 + 0.75 * vU)); }`;

const MARKS = 24, MARK_SEGMENTS = 28, MARK_VIEW = 24, LEAVES_PER = 4;
/**
 * The share of spots a front stirs, per kind, for each unit of the wind's strength over a clear day's (windy days 3);
 * the crowns' leaves by its square (a breeze takes a leaf now and then, a gale strips them).
 */
const MARK_CHANCE = { crown: 0.08, shore: 0.2, open: 0.2 }, LEAF_CHANCE = 0.06;
/** Leaf colours by season (none in winter). */
const WIND_LEAF: Record<string, string | null> = { spring: "#e8a6bd", summer: "#5e8f3f", autumn: "#c7823a", winter: null };
const _markCam = new THREE.Vector3(), _pass: FrontPass = { since: 0, front: 0 };
type MarkLeaf = { x: number; y: number; z: number; age: number; seed: number };
const _leaves: MarkLeaf[] = Array.from({ length: MARKS }, () => ({ x: 0, y: 0, z: 0, age: 0, seed: 0 }));
const _lq = new THREE.Quaternion(), _le = new THREE.Euler(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3(), _lm = new THREE.Matrix4();

/**
 * Module scope (the react compiler forbids writing through hook values): this frame's marks into the instances, and
 * the crowns' leaf bursts into `_leaves` (the count returned). `gusty` is the wind's strength over a clear day's.
 */
function stepMarks(geo: THREE.InstancedBufferGeometry, spots: readonly WindSpot[], camera: THREE.Camera, gusty: number, leafy: boolean): number {
  viewFocus(camera.position, camera.getWorldDirection(_dir), _focus);
  camera.getWorldPosition(_markCam);
  const t = worldTime(), at = geo.getAttribute("iMark") as THREE.InstancedBufferAttribute, look = geo.getAttribute("iLook") as THREE.InstancedBufferAttribute;
  // Streaks, curls and sand only once it is really blowing; leaves off the crowns in a breeze too.
  const marks = THREE.MathUtils.clamp((gusty - 1.4) / 1.6, 0, 1);
  let n = 0, l = 0;
  for (let i = 0; i < spots.length && (n < MARKS || l < MARKS); i++) {
    const sp = spots[i], dx = sp.x - _focus.x, dz = sp.z - _focus.z;
    if (Math.abs(dx) > MARK_VIEW || Math.abs(dz) > MARK_VIEW) continue;
    const { since, front } = lastFront(sp.x, sp.z, t, _pass);
    if (since >= MARK_SECONDS) continue;
    const crown = sp.kind === "crown", leaf = crown && leafy && hash01(i, front * 3 + 1) < 0.75;
    if (!stirs(i, front, leaf ? LEAF_CHANCE * gusty * gusty : MARK_CHANCE[sp.kind] * gusty * marks)) continue;
    const near = THREE.MathUtils.smoothstep(Math.hypot(sp.x - _markCam.x, sp.y - _markCam.y, sp.z - _markCam.z), MARK_NEAREST, MARK_NEAREST + 5);
    const k = near * windowFade(dx, dz, MARK_VIEW * 2);
    if (k < 0.01) continue;
    const age = since / MARK_SECONDS, seed = hash01(i, front * 3 + 2);
    if (leaf) { if (l < MARKS) Object.assign(_leaves[l++], { x: sp.x, y: sp.y, z: sp.z, age, seed }); continue; }
    if (n >= MARKS) continue;
    // Open ground blows streaks and now and then a curl; the shore its sand; a crown without leaves a curl.
    const kind = sp.kind === "shore" ? 2 : crown || seed < 0.2 ? 1 : 0;
    // Over the grass's tips (the shore's sand has none: low over it).
    at.setXYZW(n, sp.x, sp.kind === "shore" ? sp.y - 0.1 : sp.y + 0.6 + 0.5 * seed, sp.z, age);
    look.setXYZW(n, kind, seed * 37, k, 0);
    n++;
  }
  geo.instanceCount = n;
  at.needsUpdate = true;
  look.needsUpdate = true;
  return l;
}

/** A crown's leaves, torn off by the front: tumbling downwind and down, gone after MARK_SECONDS. */
function placeLeaves(mesh: THREE.InstancedMesh, count: number) {
  const d = WIND_DIR;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const b = _leaves[i];
    for (let j = 0; j < LEAVES_PER; j++) {
      const h1 = hash01(b.seed * 997 + j, 5), h2 = hash01(b.seed * 997 + j, 6), a = b.age, travel = a * FRONT_SPEED * MARK_SECONDS * (0.55 + 0.3 * h1);
      const flutter = Math.sin(a * 9 + h2 * 6.3) * 0.45, x0 = (h1 - 0.5) * 1.6, z0 = (h2 - 0.5) * 1.6;
      _lp.set(b.x + x0 + d.x * travel - d.z * flutter, b.y + (h2 - 0.5) * 0.8 + Math.sin(a * Math.PI) * 0.7 - a * 1.6, b.z + z0 + d.z * travel + d.x * flutter);
      _lq.setFromEuler(_le.set(a * 11 + h1 * 6, a * 7 + h2 * 6, a * 5));
      const grow = Math.min(1, a / 0.08) * Math.min(1, (1 - a) / 0.25);
      mesh.setMatrixAt(n++, _lm.compose(_lp, _lq, _ls.set(0.17, 0.11, 0.17).multiplyScalar(grow)));
    }
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

export function WindMarks({ spots, season }: { spots: readonly WindSpot[]; season: string }) {
  const leafColor = WIND_LEAF[season] ?? null;
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const [geo, mat] = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), u: number[] = [], side: number[] = [], index: number[] = [];
    for (let i = 0; i <= MARK_SEGMENTS; i++) { u.push(i / MARK_SEGMENTS, i / MARK_SEGMENTS); side.push(-1, 1); }
    for (let i = 0; i < MARK_SEGMENTS; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(index);
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(u.length * 3).fill(0), 3));
    g.setAttribute("aU", new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute("iMark", new THREE.InstancedBufferAttribute(new Float32Array(MARKS * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("iLook", new THREE.InstancedBufferAttribute(new Float32Array(MARKS * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uWind: { value: new THREE.Vector2(WIND_DIR.x, WIND_DIR.z) }, uTravel: { value: FRONT_SPEED * MARK_SECONDS * 0.6 } },
    });
    return [g, m];
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => {
    const leaves = stepMarks(geo, spots, camera, WIND.strength * WIND.swell, !!leafColor);
    if (leafRef.current) placeLeaves(leafRef.current, leaves);
  });
  return <>
    <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
    {leafColor && (
      <instancedMesh ref={leafRef} args={[undefined, undefined, MARKS * LEAVES_PER]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={leafColor} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    )}
  </>;
}

// ─── Golden-hour motes (sky-ambient round 1, approved; round 4 moved over the sea) ────
// David, round 3: "its kinda crazy and distracting make it less distracting and should it be on the ocean water and no
// grass?" Yes: a few glints of light hanging low over the sea, slow, small and sparse, brightest toward the low sun (the
// sparkles over the water in his sunset reference), and none over the land. Only while the sun is low (they fade in as
// it sinks under about 15° and out as it sets). World anchored on a tile round where the camera looks, carried slowly
// downwind; one over the shallows fades as the water thins, so none ever pops. One draw of points.
const MOTES = 48, MOTE_TILE = 34;
const MOTE_VERT = /* glsl */ `
attribute float alpha;
uniform float uSize;
uniform vec3 uSunDir;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.y -= mv.z * mv.z * ${ACTIVE_WORLD_BEND.toFixed(6)} + mv.x * mv.x * ${ACTIVE_WORLD_BEND_SIDE.toFixed(6)};
  gl_Position = projectionMatrix * mv;
  float beam = pow(max(dot(normalize(position - cameraPosition), uSunDir), 0.0), 4.0);
  vA = alpha * (0.12 + 1.1 * beam);
  gl_PointSize = uSize / -mv.z;
}`;
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vA;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** How golden the hour is for a sun this high (its direction's y): 0 by day and after sunset, 1 with the sun a few degrees up. */
export const goldenHour = (sunY: number) => THREE.MathUtils.smoothstep(sunY, -0.01, 0.05) * (1 - THREE.MathUtils.smoothstep(sunY, 0.16, 0.27));

/** Module scope: the motes for this moment (positions and alphas into the geometry); hidden outside golden hour. */
function stepMotes(points: THREE.Points, mat: THREE.ShaderMaterial, seed: Float32Array, camera: THREE.Camera, ground: (x: number, z: number) => number, height: number, always: boolean) {
  const golden = always ? 1 : goldenHour(skyUniforms.uSunDir.value.y);
  points.visible = golden > 0.001;
  if (!points.visible) return;
  camera.getWorldDirection(_dir);
  viewFocus(camera.position, _dir, _focus);
  const t = worldTime(), drift = (0.12 + 0.1 * WIND.strength) * WIND.swell, geo = points.geometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, alpha = geo.getAttribute("alpha") as THREE.BufferAttribute;
  const half = MOTE_TILE / 2, sea = SEA_LEVEL;
  for (let i = 0; i < MOTES; i++) {
    const a = seed[i * 4], b = seed[i * 4 + 1], c = seed[i * 4 + 2], d = seed[i * 4 + 3];
    const run = t * drift * (0.6 + 0.6 * d);
    let x = a * MOTE_TILE + WIND_DIR.x * run + Math.sin(t * 0.21 + d * 6.28) * 0.4;
    let z = c * MOTE_TILE + WIND_DIR.z * run + Math.cos(t * 0.17 + b * 6.28) * 0.4;
    x = _focus.x + THREE.MathUtils.euclideanModulo(x - _focus.x + half, MOTE_TILE) - half;
    z = _focus.z + THREE.MathUtils.euclideanModulo(z - _focus.z + half, MOTE_TILE) - half;
    // Over water only: faded in as the sea deepens past the shallows.
    const water = THREE.MathUtils.smoothstep(sea - ground(x, z), 0.05, 0.6);
    const edge = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - _focus.x, z - _focus.z) / half, 0.55, 1);
    pos.setXYZ(i, x, sea + 0.35 + b * 1.6 + Math.sin(t * 0.5 + d * 12) * 0.12, z);
    alpha.setX(i, 0.55 * golden * water * edge * (0.6 + 0.4 * Math.sin(t * 1.1 + d * 40)));
  }
  pos.needsUpdate = true;
  alpha.needsUpdate = true;
  // The canvas's height sets a point's pixels: the pixel finish draws at half size.
  mat.uniforms.uSize.value = 0.09 * height;
}

export function GoldenMotes({ ground, always = false }: { ground: (x: number, z: number) => number; always?: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const [geo, mat, seed] = useMemo(() => {
    const g = new THREE.BufferGeometry(), seed = new Float32Array(MOTES * 4);
    let h = 7;
    for (let i = 0; i < seed.length; i++) { h = (h * 16807) % 2147483647; seed[i] = h / 2147483647; }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(MOTES), 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 40 }, uSunDir: skyUniforms.uSunDir, uColor: { value: new THREE.Color(1, 0.88, 0.62) } },
    });
    return [g, m, seed];
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera, gl }) => { if (ref.current) stepMotes(ref.current, mat, seed, camera, ground, gl.domElement.height, always); });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
