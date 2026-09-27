"use client";

/**
 * Look lab rig (/lab/look, specs/look-development.md §2). Mounted inside the
 * real village Canvas. Patches the scene's own lit materials once each (a
 * shared uniform per material class, so a slider move needs no recompile):
 *   - per-class saturation and value on the albedo, after vertex colours
 *   - roughness and toy gloss (lookRoughness)
 *   - shadow tint: the key light's shadow term leaks this colour instead of
 *     going to black (black = the stock three shadow)
 * Water is unlit and takes its class look through `lookToLight`. Also reports
 * FPS, draw calls and triangles once a second.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LOOK_LIGHTS_CHUNK, lookRoughness, type LookPreset, type MaterialClass } from "@/lib/game/lookPreset";

export type LookMetrics = { fps: number; frameMs: number; calls: number; triangles: number };
type Lit = Exclude<MaterialClass, "water">;

const CLASS_UNIFORMS: Record<Lit, { value: THREE.Vector2 }> = {
  terrain: { value: new THREE.Vector2(1, 1) }, props: { value: new THREE.Vector2(1, 1) },
  foliage: { value: new THREE.Vector2(1, 1) }, characters: { value: new THREE.Vector2(1, 1) },
};
const SHADOW_TINT = { value: new THREE.Color(0, 0, 0) };
/** Patched materials: class and authored roughness. A WeakMap, not userData, which clones would copy. */
const PATCHED = new WeakMap<THREE.Material, { cls: Lit; roughness: number }>();


function classOf(material: THREE.MeshStandardMaterial): Lit {
  const tagged = material.userData.lookClass as Lit | undefined;
  if (tagged) return tagged;
  if (material.name.startsWith("terrain:")) return "terrain";
  if (material.name.startsWith("Character")) return "characters";
  return "props";
}

function patch(material: THREE.MeshStandardMaterial, cls: Lit) {
  // Keep the original program key: two materials with different hooks must not share a program.
  const key = material.customProgramCacheKey();
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    if (shader.fragmentShader.includes("uLookClass")) return; // a clone whose base hook is already patched
    shader.uniforms.uLookClass = CLASS_UNIFORMS[cls];
    shader.uniforms.uLookShadowTint = SHADOW_TINT;
    shader.fragmentShader = "uniform vec2 uLookClass;\nuniform vec3 uLookShadowTint;\n" + shader.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
        diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, uLookClass.x), 0.0) * uLookClass.y;`)
      .replace("#include <lights_fragment_begin>", LOOK_LIGHTS_CHUNK);
  };
  material.customProgramCacheKey = () => `${key}|look-v1`;
  PATCHED.set(material, { cls, roughness: material.roughness });
  material.needsUpdate = true;
}

/** Every patched material seen in the lab (module scope: the compiler forbids mutating hook values). */
const LIVE = new Set<THREE.MeshStandardMaterial>();

function setLook(preset: LookPreset | null) {
  const look = preset?.materials;
  for (const cls of Object.keys(CLASS_UNIFORMS) as Lit[]) CLASS_UNIFORMS[cls].value.set(look?.[cls].saturation ?? 1, look?.[cls].value ?? 1);
  SHADOW_TINT.value.set(preset?.shadows.tint ?? "#000000");
  for (const m of LIVE) {
    const { cls, roughness } = PATCHED.get(m)!;
    m.roughness = look ? lookRoughness(roughness, look[cls]) : roughness;
  }
}

/** Patch materials that have appeared since the last sweep (late loads, season swaps); true if any. */
function sweepScene(scene: THREE.Scene): boolean {
  let added = false;
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial) || LIVE.has(m)) continue;
      if (!PATCHED.has(m)) patch(m, classOf(m));
      LIVE.add(m);
      added = true;
    }
  });
  return added;
}

/** Authored roughness/metalness per class, for the render-value inventory (capture scripts). */
export function materialSummary() {
  const out: Record<string, { count: number; roughness: number[]; metalness: number[]; textured: number }> = {};
  for (const m of LIVE) {
    const { cls, roughness } = PATCHED.get(m)!, row = out[cls] ??= { count: 0, roughness: [], metalness: [], textured: 0 };
    row.count++; row.roughness.push(roughness); row.metalness.push(m.metalness); if (m.map) row.textured++;
  }
  const q = (v: number[], f: number) => [...v].sort((a, b) => a - b)[Math.floor(f * (v.length - 1))];
  return Object.fromEntries(Object.entries(out).map(([cls, r]) => [cls, { count: r.count, textured: r.textured,
    roughness: [q(r.roughness, 0), q(r.roughness, 0.5), q(r.roughness, 1)], metalness: [q(r.metalness, 0), q(r.metalness, 0.5), q(r.metalness, 1)] }]));
}

export default function LookRig({ preset, onMetrics }: { preset: LookPreset | null; onMetrics: (m: LookMetrics) => void }) {
  const scene = useThree(s => s.scene);
  const clock = useRef({ seconds: 1, frames: 0 });
  useEffect(() => setLook(preset), [preset]);
  // Leaving the lab: identity uniforms and authored roughness, so shared cached materials read as shipped.
  useEffect(() => () => setLook(null), []);
  useFrame(({ gl }, delta) => {
    const c = clock.current;
    c.seconds += delta; c.frames++;
    if (c.seconds < 1) return;
    onMetrics({ fps: Math.round(c.frames / c.seconds), frameMs: c.seconds * 1000 / c.frames, calls: gl.info.render.calls, triangles: gl.info.render.triangles });
    c.seconds = 0; c.frames = 0;
    if (sweepScene(scene)) setLook(preset);
  }, -101); // before the world's Performance probe resets gl.info
  return null;
}
