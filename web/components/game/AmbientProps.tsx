"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLBProp } from "./NatureModels";
import InstancedGLB from "./InstancedNature";
import { STREETLAMP_URL } from "@/lib/game/propModels";

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
export function Lanterns({ positions, intensity, glow, lamp = { url: LAMP_URL, light: [0, 2.4, 0] }, yaws, reach = 5 }: {
  positions: readonly [number, number, number][]; intensity: number; glow: number;
  /** How far each lamp's pool of light reaches; 0: they only glow (no light of their own). */
  reach?: number;
  /** Which lamp (propModels NEW_LAMPS) and its light point in the model; `yaws` turn each (radians about +y). */
  lamp?: { url: string; light: readonly [number, number, number] }; yaws?: readonly number[];
}) {
  const group = useRef<THREE.Group>(null);
  const placements = useMemo(() => positions.map((position, i) => ({ position, rotation: yaws?.[i] })), [positions, yaws]);
  useFrame((_, raw) => { if (group.current) easeGlowOnce(group.current, glow, Math.min(raw, 0.1)); });
  return (
    <group>
      {/* The globes start dark and ease to their target (a fixed prepared intensity, so the model is never rebuilt). */}
      <group ref={group}><InstancedGLB url={lamp.url} placements={placements} emissiveIntensity={0} /></group>
      {reach > 0 && positions.map((p, i) => <FadeLight key={i} color="#FFA040" intensity={intensity} distance={reach} position={lampLight(p, yaws?.[i] ?? 0, lamp.light)} />)}
    </group>
  );
}

/** Where a lamp's light sits: its model's light point turned by its yaw. */
export function lampLight(p: readonly [number, number, number], yaw: number, [lx, ly, lz]: readonly [number, number, number]): [number, number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [p[0] + lx * c + lz * s, p[1] + ly, p[2] - lx * s + lz * c];
}

/**
 * The pools of light of the `count` lamps nearest the player (the new world's many lamps, terrain v3 R2c): a fixed few
 * point lights that follow you from lamp to lamp, so the scene never pays for every lamp's light (each light costs
 * every lit draw, on or off: each of the eight it had cost about 0.1 ms a frame on High, perf-newworld). A light fades
 * out as its lamp nears the edge of the nearest few, so none pops.
 */
/**
 * A flame's breath (David, 2026-10-26: "lights should breath like fire, glow should grow and shrink like real lamps"):
 * a slow swell, a quicker waver and a flutter, uneven, each lamp at its own phase. LampGlow's shaders run the same sum.
 */
export const breath = (t: number, phase: number) => 0.84 + 0.09 * Math.sin(t * 1.9 + phase) + 0.05 * Math.sin(t * 4.7 + phase * 1.3) + 0.02 * Math.sin(t * 11 + phase * 0.7);
const BREATH_GLSL = "(0.84 + 0.09 * sin(uTime * 1.9 + ph) + 0.05 * sin(uTime * 4.7 + ph * 1.3) + 0.02 * sin(uTime * 11.0 + ph * 0.7))";
/** A lamp's phase from where it stands. */
export const lampPhase = (x: number, z: number) => x * 1.7 + z * 2.3;

export function LampPool({ points, intensity, reach, player, count = 4 }: {
  points: readonly (readonly [number, number, number])[]; intensity: number; reach: number; player: React.RefObject<THREE.Vector3>; count?: number;
}) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const order = useMemo(() => points.map((_, i) => i), [points]);
  // Each light's eased strength before its flame's breath.
  const base = useRef<number[]>([]);
  useFrame(({ clock }, raw) => {
    const { x, z } = player.current, d = (i: number) => Math.hypot(points[i][0] - x, points[i][2] - z);
    order.sort((a, b) => d(a) - d(b));
    const edge = order.length > count ? d(order[count]) : Infinity, dt = Math.min(raw, 0.1), t = clock.elapsedTime;
    lights.current.forEach((light, k) => {
      if (!light) return;
      const i = order[k];
      if (i === undefined) { light.intensity = 0; return; }
      const [px, py, pz] = points[i];
      light.position.set(px, py, pz);
      base.current[k] = THREE.MathUtils.damp(base.current[k] ?? 0, intensity * Math.min(1, Math.max(0, (edge - d(i)) / 6)), LAMP_RATE, dt);
      light.intensity = base.current[k] * breath(t, lampPhase(px, pz));
    });
  });
  return <>{Array.from({ length: count }, (_, k) => <pointLight key={k} ref={l => { lights.current[k] = l; }} color="#FFA040" intensity={0} distance={reach} />)}</>;
}

/** A soft round glow, white in the middle fading to nothing at the rim (the halos' and the pools' alpha). */
let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (glowTex = new THREE.CanvasTexture(c));
}

type GlowUniforms = { uTime: { value: number }; uOn: { value: number } };
/** A glow's shader breathing: `at` (GLSL) where its lamp stands, for its phase; its alpha by the breath and `uOn`. */
function breathe(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: GlowUniforms, at: string) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = "uniform float uTime;\nvarying float vBreath;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    vec3 glowAt = ${at};
    float ph = glowAt.x * 1.7 + glowAt.z * 2.3;
    vBreath = ${BREATH_GLSL};`);
  // The points' map is read in map_particle_fragment, the pools' in map_fragment.
  shader.fragmentShader = "uniform float uOn;\nvarying float vBreath;\n" + shader.fragmentShader.replace(/#include <map(_particle)?_fragment>/, m => `${m}\n  diffuseColor.a *= uOn * vBreath;`);
}
/** The frame (module scope: the react compiler forbids writing through hook values): the time, the ease in and out. */
function glowFrame(u: GlowUniforms, objects: readonly THREE.Object3D[], on: boolean, t: number, dt: number) {
  u.uTime.value = t;
  u.uOn.value = THREE.MathUtils.damp(u.uOn.value, on ? 1 : 0, LAMP_RATE, dt);
  for (const o of objects) o.visible = u.uOn.value > 0.01;
}

/**
 * The new world's lamps at night, cheaply (terrain v3 R2d; David, R2c: "should have like a glow homey feel and it should
 * light up larger area"): a warm halo round every lamp's light and a warm pool on the ground under it, every one
 * breathing like a flame at its own phase (the shader, from one time uniform). Two draws for all of them: the halos are
 * points, the pools one instanced disc. `on` (0 to 1) eases them in and out with the lamps.
 */
export function LampGlow({ points, ground, on, halo = 2.6, pool = 5.5 }: {
  points: readonly (readonly [number, number, number])[]; ground: (x: number, z: number) => number; on: boolean;
  /** The halo's size (world units across) and the pool's radius. */
  halo?: number; pool?: number;
}) {
  const uniforms = useMemo((): GlowUniforms => ({ uTime: { value: 0 }, uOn: { value: 0 } }), []);
  const halos = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
    const material = new THREE.PointsMaterial({ color: "#ffb35c", map: glowTexture(), size: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    material.onBeforeCompile = shader => {
      breathe(shader, uniforms, "position");
      // The halo grows and shrinks with the flame.
      shader.vertexShader = shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = size * (0.75 + 0.5 * vBreath);");
    };
    material.customProgramCacheKey = () => "lamp-halo-v1";
    const p = new THREE.Points(geometry, material);
    p.frustumCulled = false;
    p.renderOrder = 2;
    return p;
  }, [points, halo, uniforms]);
  const pools = useMemo(() => {
    const geometry = new THREE.CircleGeometry(pool, 24).rotateX(-Math.PI / 2);
    // The disc's uv runs 0 to 1 across it, as the glow wants.
    const material = new THREE.MeshBasicMaterial({ color: "#ff9a3c", map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      polygonOffset: true, polygonOffsetFactor: -2 });
    material.onBeforeCompile = shader => breathe(shader, uniforms, "(instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz");
    material.customProgramCacheKey = () => "lamp-pool-v1";
    const mesh = new THREE.InstancedMesh(geometry, material, points.length), m = new THREE.Matrix4();
    points.forEach(([x, , z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, ground(x, z) + 0.06, z)));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }, [points, ground, pool, uniforms]);
  useEffect(() => () => { for (const o of [halos, pools]) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }, [halos, pools]);
  useFrame(({ clock }, raw) => glowFrame(uniforms, [halos, pools], on, clock.elapsedTime, Math.min(raw, 0.1)));
  return <><primitive object={pools} /><primitive object={halos} /></>;
}

/** A point light that eases to its intensity (porch and doorway lamps): mounted always, so lights never recompile the scene. */
export function FadeLight({ intensity, ...props }: Omit<React.ComponentProps<"pointLight">, "intensity" | "ref"> & { intensity: number }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, raw) => { if (light.current) easeLight(light.current, intensity, Math.min(raw, 0.1)); });
  return <pointLight ref={light} intensity={0} {...props} />;
}
