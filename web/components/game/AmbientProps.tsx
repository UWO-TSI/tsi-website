"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLBProp } from "./NatureModels";

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
      <group ref={model}><GLBProp url="/assets/acnh/props/streetlamp.glb" emissiveIntensity={0} /></group>
      <pointLight ref={light} color="#FFA040" intensity={0} distance={5} position={[0, 2.4, 0]} />
    </group>
  );
}

/** A point light that eases to its intensity (porch and doorway lamps): mounted always, so lights never recompile the scene. */
export function FadeLight({ intensity, ...props }: Omit<React.ComponentProps<"pointLight">, "intensity" | "ref"> & { intensity: number }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, raw) => { if (light.current) easeLight(light.current, intensity, Math.min(raw, 0.1)); });
  return <pointLight ref={light} intensity={0} {...props} />;
}
