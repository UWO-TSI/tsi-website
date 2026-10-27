"use client";

/**
 * LoadGate (2026-07-12, David: "make sure game loads and will run smoothly
 * before putting user into the game").
 *
 * WarmupProbe (inside the Canvas): watches drei's useProgress store until
 *   every tracked asset resolves, then lets WARMUP_FRAMES real frames render
 *   behind the overlay before firing onReady. A few frames in (COMPILE_AT,
 *   once the late pools and lights have mounted) every material in the scene,
 *   in view or not, is compiled for the scene's lights and every texture it
 *   uses is uploaded (`warmHidden`: `compileAsync` has the GPU link them in
 *   parallel), and the count waits for it: nothing compiles on first sight
 *   later, in a cutscene or round a corner (2026-10-26, David: "the cut scenes
 *   needs to be smooth and pre loaded before entering"). A hard TIMEOUT_MS
 *   fallback guarantees a stuck or 404ing loader can never trap the player
 *   outside the world.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { COMPILE_AT, WARMUP_TIMEOUT_MS, warmedUp, warmupFrame } from "@/lib/game/sceneGate";

const TEXTURE_KEYS = ["map", "emissiveMap", "alphaMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const;

/** Upload every texture the scene's materials use (module scope: hook values are never written in a component). */
function uploadTextures(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const seen = new Set<THREE.Texture>();
  const take = (t: unknown) => { if (t && (t as THREE.Texture).isTexture) seen.add(t as THREE.Texture); };
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

/**
 * Every material in the scene compiled for its lights, object by object: three's `compile` stops at the first object
 * that throws, which left most of the island to compile on first sight (57 of 156 programs, measured). `compile` only
 * issues the links; `settle` waits for them, in parallel (KHR_parallel_shader_compile).
 */
function compileEach(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  scene.traverse(o => { if ((o as THREE.Mesh).material) try { gl.compile(o, camera, scene); } catch { /* drawn and compiled when first seen */ } });
}
async function settle(gl: THREE.WebGLRenderer) {
  for (let i = 0; i < 1500 && gl.info.programs?.some(p => !(p as unknown as { isReady: () => boolean }).isReady()); i++) await new Promise(r => setTimeout(r, 10));
}

/**
 * Lights that come and go with the time of day (IslandAtmosphere's rim, at dawn and dusk): a light count changing
 * relinks every lit material. Each material keeps the programs it has had, so compiling it once more for the other
 * light count makes the switch free later, at no cost to any frame. The toggle and its compile happen in one go, with
 * no frame drawn between.
 */
const TRANSIENT_LIGHTS = ["rim"];

function compileOtherLights(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  if (!scene.getObjectByProperty("type", "HemisphereLight")) return; // not a lit island scene
  for (const name of TRANSIENT_LIGHTS) {
    const there = scene.getObjectByName(name), stand = there ? null : Object.assign(new THREE.DirectionalLight(0x000000, 0), { name });
    if (there) there.visible = false; else scene.add(stand!);
    try { compileEach(gl, scene, camera); } finally { if (there) there.visible = true; else scene.remove(stand!); }
  }
}

export async function warmHidden(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  uploadTextures(gl, scene);
  compileEach(gl, scene, camera);
  compileOtherLights(gl, scene, camera);
  await settle(gl);
}

export function WarmupProbe({ onReady }: { onReady: () => void }) {
  const framesRef = useRef(0);
  const firedRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const compile = useRef<{ done: boolean } | null>(null);

  useFrame(({ gl, scene, camera }) => {
    if (firedRef.current) return;
    if (startRef.current === null) startRef.current = performance.now();
    const timedOut = performance.now() - startRef.current > WARMUP_TIMEOUT_MS;
    // Imperative store read: subscribing via the useProgress() hook made
    // React update this component while a suspended GLB was mid-render
    // (the loading manager fires inside that resolution) — the classic
    // "cannot update while rendering" warning. getState() has no such tie.
    const { active, progress } = useProgress.getState();
    const loaded = !active && progress >= 100;
    if (!loaded) compile.current = null; // a late loader: compile again once it settles
    else if (framesRef.current === COMPILE_AT && !compile.current) {
      const job = { done: false };
      compile.current = job;
      void warmHidden(gl, scene, camera).catch(() => {}).finally(() => { job.done = true; });
    }
    framesRef.current = warmupFrame(framesRef.current, loaded, timedOut, !!compile.current && !compile.current.done);
    if (warmedUp(framesRef.current)) {
      firedRef.current = true;
      // Defer out of the R3F frame loop: firing setState synchronously here
      // can land mid-render of a just-resolved suspended GLB component
      // ("Cannot update a component while rendering a different component").
      window.setTimeout(onReady, 0);
    }
  });
  return null;
}
