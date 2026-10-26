"use client";

import { useMemo, useRef } from "react";
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
 * every lit draw, on or off). A light fades out as its lamp nears the edge of the nearest few, so none pops.
 */
export function LampPool({ points, intensity, reach, player, count = 8 }: {
  points: readonly (readonly [number, number, number])[]; intensity: number; reach: number; player: React.RefObject<THREE.Vector3>; count?: number;
}) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const order = useMemo(() => points.map((_, i) => i), [points]);
  useFrame((_, raw) => {
    const { x, z } = player.current, d = (i: number) => Math.hypot(points[i][0] - x, points[i][2] - z);
    order.sort((a, b) => d(a) - d(b));
    const edge = order.length > count ? d(order[count]) : Infinity, dt = Math.min(raw, 0.1);
    lights.current.forEach((light, k) => {
      if (!light) return;
      const i = order[k];
      if (i === undefined) { light.intensity = 0; return; }
      light.position.set(...points[i]);
      easeLight(light, intensity * Math.min(1, Math.max(0, (edge - d(i)) / 6)), dt);
    });
  });
  return <>{Array.from({ length: count }, (_, k) => <pointLight key={k} ref={l => { lights.current[k] = l; }} color="#FFA040" intensity={0} distance={reach} />)}</>;
}

/** A point light that eases to its intensity (porch and doorway lamps): mounted always, so lights never recompile the scene. */
export function FadeLight({ intensity, ...props }: Omit<React.ComponentProps<"pointLight">, "intensity" | "ref"> & { intensity: number }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, raw) => { if (light.current) easeLight(light.current, intensity, Math.min(raw, 0.1)); });
  return <pointLight ref={light} intensity={0} {...props} />;
}
