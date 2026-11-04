"use client";

/**
 * Development only: the sky-ambient lane's round 1 pitches on the island (lib/game/skyLab.ts, specs/sky-ambient.md).
 * Mounted by IslandAtmosphere only while a `?sky=`, `?wind=`, `?amb=` or `?skytilt=` switch is set, never in production.
 *
 * - The shared wind: one direction, strength and slow gusts on the world clock, written into the grass (WIND_LAB), the
 *   trees (TREE_WIND, TREE_LEAN), the clouds (SkyDome) and the particles below.
 * - Light motes: pollen and dust drifting downwind round the view, brighter looking toward the sun (one draw).
 * - Wind swirls: a few white curls riding the gusts on breezy and stormy days (one draw).
 * - The shoot's hooks: the view's tilt and turn, and `window.__sky` (swap the pitch, move the clock, set the view).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { setSkyLab, sharedWindAt, skyLab, useSkyLab, WIND_LAB, type SharedWind, type SkyLabState } from "@/lib/game/skyLab";
import { skyLabUniforms, skyUniforms } from "@/lib/game/skyShader";
import { TREE_LEAN, TREE_WIND } from "@/lib/game/modelMaterials";
import { worldTime, setWorldClockOffset } from "@/lib/game/worldClock";
import { parseClockOverride } from "@/lib/game/islandTime";
import { orbit } from "@/lib/game/orbitCamera";
import { viewFocus } from "@/lib/game/worldFx";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";
import type { IslandWeather } from "@/lib/game/islandWeather";

const BEND = `mv.y -= mv.z * mv.z * ${ACTIVE_WORLD_BEND.toFixed(6)} + mv.x * mv.x * ${ACTIVE_WORLD_BEND_SIDE.toFixed(6)};`;
const wind: SharedWind = { dirX: Math.cos(0.35), dirZ: Math.sin(0.35), strength: 0, gust: 0 };
const _dir = new THREE.Vector3(), _focus = { x: 0, z: 0 };

if (typeof window !== "undefined") {
  Object.assign(window, { __sky: {
    set: (next: Partial<Omit<SkyLabState, "amb">> & { amb?: string[] }) => setSkyLab({ ...next, amb: next.amb ? new Set(next.amb) as SkyLabState["amb"] : skyLab().amb }),
    /** Move the world clock to HH:MM (Toronto) on a date; the island re-reads it at once. */
    at: (hhmm: string, date: string) => {
      const d = parseClockOverride(new URLSearchParams({ at: hhmm, date }));
      if (!d) return false;
      setWorldClockOffset(d.getTime() - Date.now());
      document.dispatchEvent(new Event("visibilitychange"));
      return true;
    },
    view: (v: { yaw?: number; pitch?: number; zoom?: number }) => {
      for (const o of [orbit.target, orbit.view]) Object.assign(o, v);
    },
    wind: () => ({ ...wind }),
  } });
}

/** The tilt and the turn, after the follow camera (priority -3). */
function SkyCamera({ tilt, face }: { tilt: number; face: SkyLabState["face"] }) {
  useFrame(({ camera }) => {
    if (face) {
      const d = face === "sun" ? skyLabUniforms.uSunDir.value : skyLabUniforms.uMoonDir.value;
      orbit.target.yaw = orbit.view.yaw = Math.atan2(d.x, d.z);
    }
    if (tilt) { camera.rotateX(THREE.MathUtils.degToRad(tilt)); camera.updateMatrixWorld(); }
  }, -2);
  return null;
}

/** The shared wind into the grass, the trees and the clouds. */
function SharedWindDriver({ level }: { level: NonNullable<SkyLabState["wind"]> }) {
  useFrame(() => {
    const t = worldTime();
    sharedWindAt(level, t, wind);
    WIND_LAB.on = true; WIND_LAB.grass = wind.strength; WIND_LAB.dirX = wind.dirX; WIND_LAB.dirZ = wind.dirZ;
    TREE_WIND.value.x = t;
    TREE_WIND.value.y = 0.03 * wind.strength;
    const lean = 0.07 * wind.strength * (0.3 + 0.7 * wind.gust);
    TREE_LEAN.value.set(wind.dirX * lean, wind.dirZ * lean);
  });
  useEffect(() => () => { WIND_LAB.on = false; WIND_LAB.grass = 1; TREE_LEAN.value.set(0, 0); }, []);
  return null;
}

const MOTE_VERT = /* glsl */ `
attribute vec4 seed;
uniform float uTime, uTile, uStrength, uDay, uSize;
uniform vec3 uFocus, uSunDir;
uniform vec2 uWind;
varying float vA;
void main() {
  float t = uTime;
  vec2 xz = seed.xz * uTile + uWind * t * (0.3 + 0.3 * seed.w) * uStrength
    + vec2(sin(t * 0.7 + seed.w * 6.28), cos(t * 0.53 + seed.y * 6.28)) * 0.45;
  xz = uFocus.xz + mod(xz - uFocus.xz + uTile * 0.5, uTile) - uTile * 0.5;
  vec3 p = vec3(xz.x, uFocus.y + 0.3 + seed.y * 3.0 + sin(t * 0.9 + seed.w * 12.0) * 0.25, xz.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  ${BEND}
  gl_Position = projectionMatrix * mv;
  float edge = length(xz - uFocus.xz) / (uTile * 0.5);
  float beam = pow(max(dot(normalize(p - cameraPosition), uSunDir), 0.0), 3.0);
  vA = uDay * (1.0 - smoothstep(0.6, 1.0, edge)) * (0.3 + 1.5 * beam) * (0.65 + 0.35 * sin(t * 2.3 + seed.w * 40.0));
  gl_PointSize = uSize * (0.6 + 0.8 * seed.w) / -mv.z;
}`;
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Where the view looks, the clock and the wind, into an effect's uniforms (module scope: hook values are never written in a component). */
function stepFocus(mat: THREE.ShaderMaterial, camera: THREE.Camera, ground: (x: number, z: number) => number) {
  const u = mat.uniforms;
  camera.getWorldDirection(_dir);
  viewFocus(camera.position, _dir, _focus);
  u.uTime.value = worldTime();
  u.uFocus.value.set(_focus.x, ground(_focus.x, _focus.z), _focus.z);
  u.uWind.value.set(wind.dirX, wind.dirZ);
}
function stepMotes(mat: THREE.ShaderMaterial, camera: THREE.Camera, ground: (x: number, z: number) => number, height: number) {
  stepFocus(mat, camera, ground);
  const u = mat.uniforms;
  u.uStrength.value = WIND_LAB.on ? wind.strength : 1;
  u.uDay.value = 1 - skyUniforms.uNight.value;
  // The canvas's height sets a point's pixels: the pixel finish draws at half size.
  u.uSize.value = 0.12 * height;
}

function stepSwirls(mat: THREE.ShaderMaterial, camera: THREE.Camera, ground: (x: number, z: number) => number) {
  stepFocus(mat, camera, ground);
  mat.uniforms.uChance.value = THREE.MathUtils.clamp((wind.strength - 0.8) / 2, 0, 0.95);
}

/** Light motes: pollen and dust, world-anchored on a tile round the view, drifting downwind (one draw). */
function Motes({ ground, count }: { ground: (x: number, z: number) => number; count: number }) {
  const { gl } = useThree();
  const [geo, mat] = useMemo(() => {
    const g = new THREE.BufferGeometry(), seed = new Float32Array(count * 4);
    let h = 7;
    for (let i = 0; i < seed.length; i++) { h = (h * 16807) % 2147483647; seed[i] = h / 2147483647; }
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uTile: { value: 22 }, uStrength: { value: 1 }, uDay: { value: 1 }, uSize: { value: 40 },
        uFocus: { value: new THREE.Vector3() }, uSunDir: skyLabUniforms.uSunDir, uWind: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(1, 0.93, 0.72) },
      },
    });
    return [g, m];
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepMotes(mat, camera, ground, gl.domElement.height));
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

const SWIRL_VERT = /* glsl */ `
attribute float aU, aSide;
attribute float iSeed;
uniform float uTime, uTile, uChance;
uniform vec3 uFocus;
uniform vec2 uWind;
varying float vA;
float h(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
// A run downwind, a loop up and over, and on.
vec3 path(float u, vec3 o, vec3 d, float L, float r) {
  float s = u * L, at = L * 0.5, loopLen = 6.2832 * r;
  if (s < at) return o + d * s + vec3(0.0, sin(s * 1.3) * 0.06, 0.0);
  if (s < at + loopLen) { float a = (s - at) / r; return o + d * (at + r * sin(a)) + vec3(0.0, r * (1.0 - cos(a)), 0.0); }
  return o + d * (s - loopLen) + vec3(0.0, sin(s * 1.1) * 0.05, 0.0);
}
void main() {
  float P = 3.4, t = uTime + iSeed * 1.37, c = floor(t / P), age = (t - c * P) / P, k = iSeed * 17.0 + c;
  vA = 0.0;
  if (h(k + 0.5) > uChance) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 d = vec3(uWind.x, 0.0, uWind.y);
  vec3 o = vec3(uFocus.x + (h(k + 1.1) - 0.5) * uTile, uFocus.y + 0.5 + h(k + 2.3) * 2.0, uFocus.z + (h(k + 3.7) - 0.5) * uTile) - d * 2.5;
  float L = 5.5, r = 0.32 + 0.22 * h(k + 4.1), head = age * 1.45, len = 0.42;
  float uu = clamp(head - len + aU * len, 0.0, 1.0);
  vec3 p = path(uu, o, d, L, r), q = path(min(uu + 0.01, 1.0), o, d, L, r);
  vec3 side = normalize(cross(normalize(q - p + vec3(0.0, 1e-5, 0.0)), normalize(cameraPosition - p)));
  p += side * aSide * 0.045 * sin(aU * 3.1416);
  vA = smoothstep(0.0, 0.12, age) * smoothstep(1.0, 0.7, age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  ${BEND}
  gl_Position = projectionMatrix * mv;
}`;
const SWIRL_FRAG = /* glsl */ `
varying float vA;
void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 0.75 * vA); }`;

const SWIRLS = 8, SEGMENTS = 32;
/** Wind swirls: white curls riding the gusts (one instanced draw); how many show is the wind's strength. */
function Swirls({ ground }: { ground: (x: number, z: number) => number }) {
  const [geo, mat] = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), u: number[] = [], side: number[] = [], index: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) { u.push(i / SEGMENTS, i / SEGMENTS); side.push(-1, 1); }
    for (let i = 0; i < SEGMENTS; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(index);
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(u.length * 3).fill(0), 3));
    g.setAttribute("aU", new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute("iSeed", new THREE.InstancedBufferAttribute(new Float32Array([...Array(SWIRLS).keys()]), 1));
    g.instanceCount = SWIRLS;
    const m = new THREE.ShaderMaterial({
      vertexShader: SWIRL_VERT, fragmentShader: SWIRL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uTile: { value: 20 }, uChance: { value: 0 }, uFocus: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() } },
    });
    return [g, m];
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepSwirls(mat, camera, ground));
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

export default function SkyLab({ weather, ground }: { weather: IslandWeather; ground: (x: number, z: number) => number }) {
  const s = useSkyLab();
  // A ?weather=wind day with no ?wind= set blows a storm through the swirls; otherwise the pitch's level.
  const level = s.wind ?? (s.amb.has("swirls") ? (weather === "wind" ? "storm" : "breeze") : null);
  const wet = weather === "rain" || weather === "snow" || weather === "fog";
  return <>
    {(s.tilt !== 0 || s.face) && <SkyCamera tilt={s.tilt} face={s.face} />}
    {level && <SharedWindDriver level={level} />}
    {s.amb.has("motes") && !wet && <Motes ground={ground} count={160} />}
    {s.amb.has("swirls") && <Swirls ground={ground} />}
  </>;
}
