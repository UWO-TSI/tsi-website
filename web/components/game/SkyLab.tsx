"use client";

/**
 * Development only: the sky-ambient lane's round 1 pitches on the island (lib/game/skyLab.ts, specs/sky-ambient.md).
 * Mounted by IslandAtmosphere only while a `?wind=`, `?amb=`, `?skytilt=` or `?skyface=` switch is set, never in production.
 *
 * - The shared wind: one direction, strength and slow gusts on the world clock, written into the grass (WIND_LAB), the
 *   trees (TREE_WIND, TREE_LEAN), the clouds (SkyDome) and the particles below.
 * - Light motes: pollen and dust drifting downwind round the view, brighter looking toward the sun (one draw).
 * - The shoot's hooks: the view's tilt and turn, and `window.__sky` (swap the pitch, move the clock, set the view).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { setSkyLab, sharedWindAt, skyLab, useSkyLab, WIND_LAB, type SharedWind, type SkyLabState } from "@/lib/game/skyLab";
import { skyUniforms } from "@/lib/game/skyShader";
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
      const d = face === "sun" ? skyUniforms.uSunDir.value : skyUniforms.uMoonDir.value;
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
    TREE_WIND.value.y = 0.05 * wind.strength;
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
  u.uSize.value = 0.14 * height;
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
        uFocus: { value: new THREE.Vector3() }, uSunDir: skyUniforms.uSunDir, uWind: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(1, 0.93, 0.72) },
      },
    });
    return [g, m];
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ camera }) => stepMotes(mat, camera, ground, gl.domElement.height));
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

export default function SkyLab({ weather, ground }: { weather: IslandWeather; ground: (x: number, z: number) => number }) {
  const s = useSkyLab();
  const level = s.wind;
  const wet = weather === "rain" || weather === "snow" || weather === "fog";
  return <>
    {(s.tilt !== 0 || s.face) && <SkyCamera tilt={s.tilt} face={s.face} />}
    {level && <SharedWindDriver level={level} />}
    {s.amb.has("motes") && !wet && <Motes ground={ground} count={160} />}
  </>;
}
