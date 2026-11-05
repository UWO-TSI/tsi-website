"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLBProp } from "./NatureModels";
import InstancedGLB, { MergedModels, type ModelPlacement } from "./InstancedNature";
import { STREETLAMP_URL } from "@/lib/game/propModels";
import { breath, glowTexture } from "@/lib/game/glow";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";

/** Seconds-ish a lamp takes to come up to full (or go out): an ease, never a switch (living-village §5). */
const LAMP_RATE = 0.9;

/** Module scope (the react compiler forbids writing through hook values): the globe's own emission, eased. */
function easeGlow(group: THREE.Object3D, target: number, dt: number) {
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, target, LAMP_RATE, dt);
    }
  });
}
function easeLight(light: THREE.PointLight, target: number, dt: number) {
  light.intensity = THREE.MathUtils.damp(light.intensity, target, LAMP_RATE, dt);
}

// ─── Lantern (ACNH round streetlamp) ────────────────────────────────────
// Model is ~2.7u tall with the globe at the top; the warm point light sits
// in the globe so night pools read like the W7 cozy lamps. The globe and its
// pool fade up over a few seconds when the lamps come on, and down again.
// Only the applicant island (components/recruit, live and outside the game's lanes) still draws this one lamp at a
// time; the game's scenes draw our own lamp, instanced (Lanterns).
const ACNH_LAMP_URL = "/assets/acnh/props/streetlamp.glb";
export function Lantern({ position, lampsOn = true, intensity, glow }: { position: [number, number, number]; lampsOn?: boolean; intensity?: number; glow?: number }) {
  const model = useRef<THREE.Group>(null), light = useRef<THREE.PointLight>(null);
  const glowTarget = glow ?? (lampsOn ? 2.2 : 0), lightTarget = intensity ?? (lampsOn ? 0.4 : 0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    if (model.current) easeGlow(model.current, glowTarget, dt);
    if (light.current) easeLight(light.current, lightTarget, dt);
  });
  return (
    <group position={position}>
      {/* The globe starts dark and eases to its target (a fixed prepared intensity, so the model is never rebuilt). */}
      <group ref={model}><GLBProp url={ACNH_LAMP_URL} emissiveIntensity={0} /></group>
      <pointLight ref={light} color="#FFA040" intensity={0} distance={5} position={[0, 2.4, 0]} />
    </group>
  );
}

/** Our street lamp (art/props/build_streetlamp.py): the same height and light point as the ACNH one. */
const LAMP_URL = STREETLAMP_URL;
/** The frame a shared globe material was last eased in (each eases once a frame, however many meshes share it). */
let lampFrame = 0;
function easeGlowOnce(group: THREE.Object3D, target: number, dt: number) {
  lampFrame++;
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial) || !m.emissiveMap || m.userData.lampFrame === lampFrame) continue;
      m.userData.lampFrame = lampFrame;
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, target, LAMP_RATE, dt);
    }
  });
}

/**
 * Every streetlamp of a scene as one instanced model (v1 performance): a draw per material for all of them (the iron and
 * the frosted panes), where each Lantern drew its own five.
 * The globes share their materials, so they ease up and down together as the Lanterns' did; each lamp keeps its own
 * pool of light.
 */
/** How far a lantern's light reaches (its point light's distance: nothing past it). */
export const LANTERN_REACH = 5;

export function Lanterns({ positions, intensity, glow, lamp = { url: LAMP_URL, light: [0, 2.4, 0] }, yaws, lit }: {
  positions: readonly [number, number, number][]; intensity: number; glow: number;
  /** Which lamp (propModels NEW_LAMPS) and its light point in the model; `yaws` turn each (radians about +y). */
  lamp?: { url: string; light: readonly [number, number, number] }; yaws?: readonly number[];
  /** Which lamps get a light (by where it sits): every lamp's light is a loop in every lit fragment's shader. All by default. */
  lit?: (light: [number, number, number]) => boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const placements = useMemo(() => positions.map((position, i) => ({ position, rotation: yaws?.[i] })), [positions, yaws]);
  useFrame((_, raw) => { if (group.current) easeGlowOnce(group.current, glow, Math.min(raw, 0.1)); });
  return (
    <group>
      {/* The globes start dark and ease to their target (a fixed prepared intensity, so the model is never rebuilt). */}
      <group ref={group}><InstancedGLB url={lamp.url} placements={placements} emissiveIntensity={0} /></group>
      {positions.map((p, i) => { const at = lampLight(p, yaws?.[i] ?? 0, lamp.light); return (!lit || lit(at)) && <FadeLight key={i} color="#FFA040" intensity={intensity} distance={LANTERN_REACH} position={at} />; })}
    </group>
  );
}

/** The new world's lamps, which only glow (their pools are LampPool's): every kind's placements merged by look (perf-newworld), the globes easing together. */
export function GlowingLamps({ items, glow }: { items: readonly ModelPlacement[]; glow: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, raw) => { if (group.current) easeGlowOnce(group.current, glow, Math.min(raw, 0.1)); });
  return <group ref={group}><MergedModels items={items} emissiveIntensity={0} /></group>;
}

/** Where a lamp's light sits: its model's light point turned by its yaw. */
export function lampLight(p: readonly [number, number, number], yaw: number, [lx, ly, lz]: readonly [number, number, number]): [number, number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [p[0] + lx * c + lz * s, p[1] + ly, p[2] - lx * s + lz * c];
}

/** lib/game/glow.ts breath, in GLSL. */
const BREATH_GLSL = "(0.84 + 0.09 * sin(uTime * 1.9 + ph) + 0.05 * sin(uTime * 4.7 + ph * 1.3) + 0.02 * sin(uTime * 11.0 + ph * 0.7))";
/** A lamp's phase from where it stands. */
export const lampPhase = (x: number, z: number) => x * 1.7 + z * 2.3;

/**
 * The pools of light of the `count` lamps nearest the player (the new world's many lamps, terrain v3 R2c): a fixed few
 * point lights that follow you from lamp to lamp, so the scene never pays for every lamp's light (each light costs
 * every lit draw, on or off: each of the eight it had cost about 0.1 ms a frame on High, perf-newworld). A light fades
 * out as its lamp nears the edge of the nearest few, so none pops.
 */
export function LampPool({ points, intensity, reach, player, count = 4 }: {
  points: readonly (readonly [number, number, number])[]; intensity: number; reach: number; player: React.RefObject<THREE.Vector3>; count?: number;
}) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const order = useMemo(() => points.map((_, i) => i), [points]);
  const dist = useMemo(() => new Float32Array(points.length), [points]);
  // Each light's eased strength before its flame's breath.
  const base = useRef<number[]>([]);
  useFrame(({ clock }, raw) => {
    const { x, z } = player.current;
    points.forEach(([px, , pz], i) => { dist[i] = Math.hypot(px - x, pz - z); });
    order.sort((a, b) => dist[a] - dist[b]);
    const edge = order.length > count ? dist[order[count]] : Infinity, dt = Math.min(raw, 0.1), t = clock.elapsedTime;
    lights.current.forEach((light, k) => {
      if (!light) return;
      const i = order[k];
      if (i === undefined) { light.intensity = 0; return; }
      const [px, py, pz] = points[i];
      light.position.set(px, py, pz);
      base.current[k] = THREE.MathUtils.damp(base.current[k] ?? 0, intensity * Math.min(1, Math.max(0, (edge - dist[i]) / 6)), LAMP_RATE, dt);
      light.intensity = base.current[k] * breath(t, lampPhase(px, pz));
    });
  });
  return <>{Array.from({ length: count }, (_, k) => <pointLight key={k} ref={l => { lights.current[k] = l; }} color="#FFA040" intensity={0} distance={reach} />)}</>;
}

type GlowUniforms = { uTime: { value: number }; uOn: { value: number } };
/** A glow's shader breathing: `at` (GLSL) where its lamp stands, for its phase; its alpha by the breath and `uOn`. */
function breathe(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: GlowUniforms, at: string) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = "uniform float uTime;\nvarying float vBreath;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    vec3 glowAt = ${at};
    float ph = glowAt.x * 1.7 + glowAt.z * 2.3;
    vBreath = ${BREATH_GLSL};`);
  shader.fragmentShader = "uniform float uOn;\nvarying float vBreath;\n" + shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.a *= uOn * vBreath;");
}
/** The frame (module scope: the react compiler forbids writing through hook values): the time, the ease in and out. */
function glowFrame(u: GlowUniforms, objects: readonly THREE.Object3D[], on: boolean, t: number, dt: number) {
  u.uTime.value = t;
  u.uOn.value = THREE.MathUtils.damp(u.uOn.value, on ? 1 : 0, LAMP_RATE, dt);
  for (const o of objects) o.visible = u.uOn.value > 0.01;
}

/**
 * A lamp's halo (sky-ambient round 2; David, the title's round 4: the lights "should look kinda real likes where it
 * molds around the light source, and also it isnt a hard cut off, rather the glow fades very softly"): a quad facing the
 * camera, lifted toward it past the lamp's head so the glass never cuts it, a white-hot core in the flame's colour
 * wrapping the glass and a long tail that fades to nothing (glow.ts softGlow, here in the shader, dithered), a little
 * taller than wide like the glass, breathing with the flame. One instanced draw for every lamp.
 */
const HALO_VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uSize;
uniform float uLift;
varying vec2 vUv;
varying float vBreath;
void main() {
  vec3 at = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float ph = at.x * 1.7 + at.z * 2.3;
  vBreath = ${BREATH_GLSL};
  vec4 mv = viewMatrix * vec4(at, 1.0);
  mv.xyz += normalize(-mv.xyz) * uLift;
  mv.y -= mv.z * mv.z * ${ACTIVE_WORLD_BEND.toFixed(6)} + mv.x * mv.x * ${ACTIVE_WORLD_BEND_SIDE.toFixed(6)};
  mv.xy += position.xy * uSize * (0.8 + 0.4 * vBreath);
  vUv = position.xy * 2.0;
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = /* glsl */ `
uniform float uOn;
uniform vec3 uCore;
uniform vec3 uEdge;
varying vec2 vUv;
varying float vBreath;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 >= 1.0) discard;
  float core = exp(-r2 / 0.03), glow = pow(1.0 - r2, 2.5) * (0.22 + 0.78 * exp(-r2 / 0.045));
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float a = max(0.0, glow * uOn * vBreath + dither / 255.0);
  gl_FragColor = vec4(mix(uEdge, uCore, core), a);
}`;

/**
 * The new world's lamps at night, cheaply (terrain v3 R2d; David, R2c: "should have like a glow homey feel and it should
 * light up larger area"): a warm halo round every lamp's light (above) and a warm pool on the ground under it, every
 * one breathing like a flame at its own phase (the shader, from one time uniform). Two draws for all of them: the halos
 * and the pools, each one instanced quad. `on` (0 to 1) eases them in and out with the lamps.
 */
export function LampGlow({ points, ground, on, halo = 2.6, pool = 5.5, color }: {
  points: readonly (readonly [number, number, number])[]; ground: (x: number, z: number) => number; on: boolean;
  /** The halo's size (world units across) and the pool's radius. */
  halo?: number; pool?: number;
  /** Halo and pool in one colour (the fountain's water), in place of the flame's two. */
  color?: string;
}) {
  const uniforms = useMemo((): GlowUniforms => ({ uTime: { value: 0 }, uOn: { value: 0 } }), []);
  const halos = useMemo(() => {
    const edge = new THREE.Color(color ?? "#ff9a40"), core = color ? new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.5) : new THREE.Color("#fff1d6");
    const material = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...uniforms, uSize: { value: new THREE.Vector2(halo, halo * 1.15) }, uLift: { value: halo * 0.3 }, uCore: { value: core }, uEdge: { value: edge } },
    });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, points.length), m = new THREE.Matrix4();
    points.forEach(([x, y, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, y, z)));
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }, [points, halo, color, uniforms]);
  const pools = useMemo(() => {
    const geometry = new THREE.CircleGeometry(pool, 24).rotateX(-Math.PI / 2);
    // The disc's uv runs 0 to 1 across it, as the glow wants.
    const material = new THREE.MeshBasicMaterial({ color: color ?? "#ff9a3c", map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      polygonOffset: true, polygonOffsetFactor: -2 });
    material.onBeforeCompile = shader => breathe(shader, uniforms, "(instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz");
    material.customProgramCacheKey = () => "lamp-pool-v1";
    const mesh = new THREE.InstancedMesh(geometry, material, points.length), m = new THREE.Matrix4();
    points.forEach(([x, , z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, ground(x, z) + 0.06, z)));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }, [points, ground, pool, color, uniforms]);
  const meshes = useMemo(() => [halos, pools], [halos, pools]);
  useEffect(() => () => { for (const o of meshes) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }, [meshes]);
  useFrame(({ clock }, raw) => glowFrame(uniforms, meshes, on, clock.elapsedTime, Math.min(raw, 0.1)));
  return <><primitive object={pools} /><primitive object={halos} /></>;
}

/** A point light that eases to its intensity (porch and doorway lamps): mounted always, so lights never recompile the scene. */
export function FadeLight({ intensity, ...props }: Omit<React.ComponentProps<"pointLight">, "intensity" | "ref"> & { intensity: number }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, raw) => { if (light.current) easeLight(light.current, intensity, Math.min(raw, 0.1)); });
  return <pointLight ref={light} intensity={0} {...props} />;
}
