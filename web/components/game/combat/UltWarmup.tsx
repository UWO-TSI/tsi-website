"use client";

/**
 * The ruins gate's warm-up for what waits hidden (specs/perf/2026-10-results.md; K5-perf.md proposal 1): the first ult
 * of a session used to stall 100–625 ms while its effects' shaders compiled and their textures uploaded (the pooled FX
 * meshes, the Warden's beasts and trees, the Joker's mirror, the skeleton army: all mounted, but never drawn until
 * cast). Once everything has loaded, behind the gate's fade (WarmupProbe's frames), every material in the scene, shown
 * or not, is compiled for the scene's lights (`compileAsync`: the GPU links them in parallel) and every texture they
 * use is uploaded. Once per mount; nothing per frame after.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";

/** Frames to wait after loading settles: the scene's own first frames mount the late pools and lights. */
const SETTLE = 3;
const TEXTURE_KEYS = ["map", "emissiveMap", "alphaMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const;

/** Upload every texture the scene's materials use (module scope: hook values are never written in a component). */
function uploadTextures(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const seen = new Set<THREE.Texture>();
  const take = (t: unknown) => { if (t && (t as THREE.Texture).isTexture && !seen.has(t as THREE.Texture)) seen.add(t as THREE.Texture); };
  scene.traverse(o => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      const rec = mat as unknown as Record<string, unknown>;
      for (const k of TEXTURE_KEYS) take(rec[k]);
      const uniforms = (mat as THREE.ShaderMaterial).uniforms;
      if (uniforms) for (const u of Object.values(uniforms)) take(u?.value);
    }
  });
  for (const t of seen) if ((t as THREE.Texture & { image?: unknown }).image) gl.initTexture(t);
}

export function warmHidden(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  uploadTextures(gl, scene);
  return gl.compileAsync(scene, camera);
}

export default function UltWarmup() {
  const state = useRef({ frames: 0, done: false });
  useFrame(({ gl, scene, camera }) => {
    const s = state.current;
    if (s.done) return;
    if (useProgress.getState().active) { s.frames = 0; return; }
    if (++s.frames < SETTLE) return;
    s.done = true;
    void warmHidden(gl, scene, camera);
  });
  return null;
}
