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

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { COMPILE_AT, WARMUP_FRAMES, WARMUP_TIMEOUT_MS, enterWorld, warmedUp, warmupFrame } from "@/lib/game/sceneGate";
import { setLoadPart } from "@/lib/game/loadProgress";

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
function compileEach(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, root: THREE.Object3D = scene, target?: Target) {
  asDrawn(gl, scene, target, () => root.traverse(o => { if ((o as THREE.Mesh).material) try { gl.compile(o, camera, scene); } catch { /* drawn and compiled when first seen */ } }));
}

/**
 * Compile for the output the frame really draws to. A program is keyed by it: the post-processing chain draws the
 * scene into a render target (linear output), and `compile` with nothing bound keys for the canvas (sRGB), so every
 * program it made was one the frame never used (measured: the crossing still linked the island's whole rim set).
 * Read off a program already drawn, or, before anything is (`holdDraws`), off the target the frame would have drawn into
 * (three's rule: any render target but an XR one is linear); bind a 1 px target while compiling when it says linear.
 */
type Target = THREE.WebGLRenderTarget | null | undefined;
let linearTarget: THREE.WebGLRenderTarget | null = null;
function asDrawn(gl: THREE.WebGLRenderer, scene: THREE.Scene, target: Target, run: () => void) {
  let linear: boolean | null = null;
  scene.traverse(o => {
    const m = (o as THREE.Mesh).material;
    if (linear !== null || !m || Array.isArray(m)) return;
    const key = (gl.properties.get(m) as { currentProgram?: { cacheKey?: string } }).currentProgram?.cacheKey?.split(",");
    const at = key ? key.findIndex(k => k === "highp" || k === "mediump" || k === "lowp") : -1;
    if (at >= 0) linear = key![at + 1] === THREE.LinearSRGBColorSpace;
  });
  if (linear === null && target !== undefined) linear = target !== null && !(target as { isXRRenderTarget?: boolean }).isXRRenderTarget;
  const before = gl.getRenderTarget();
  if (linear) gl.setRenderTarget(linearTarget ??= new THREE.WebGLRenderTarget(1, 1));
  try { run(); } finally { gl.setRenderTarget(before); }
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

function compileOtherLights(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, roots: readonly THREE.Object3D[] = [scene], target?: Target) {
  if (!scene.getObjectByProperty("type", "HemisphereLight")) return; // not a lit island scene
  for (const name of TRANSIENT_LIGHTS) {
    const there = scene.getObjectByName(name), stand = there ? null : Object.assign(new THREE.DirectionalLight(0x000000, 0), { name });
    if (there) there.visible = false; else scene.add(stand!);
    try { for (const root of roots) compileEach(gl, scene, camera, root, target); } finally { if (there) there.visible = true; else scene.remove(stand!); }
  }
}

/**
 * Things that fade out (`userData.fades`: a fleeing bug, VillageLife `fade`) draw blended while they do, and three
 * draws a blended two-sided material in two passes, a program each: compiled here for both light counts, so the first
 * bug you scare off doesn't stall the frame (measured: 482 ms, its wings and body). The materials go back to opaque;
 * `needsUpdate` sends them back to the programs they had.
 */
function compileFading(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target?: Target) {
  const roots: THREE.Object3D[] = [], opaque = new Set<THREE.Material>();
  scene.traverse(o => { if (o.userData.fades) roots.push(o); });
  for (const root of roots) root.traverse(o => {
    const m = (o as THREE.Mesh).material;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) if (!mat.transparent) opaque.add(mat);
  });
  if (!opaque.size) return;
  for (const m of opaque) m.transparent = true;
  try {
    for (const root of roots) compileEach(gl, scene, camera, root, target);
    compileOtherLights(gl, scene, camera, roots, target);
  } finally { for (const m of opaque) { m.transparent = false; m.needsUpdate = true; } }
}

export async function warmHidden(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target?: Target) {
  uploadTextures(gl, scene);
  compileEach(gl, scene, camera, scene, target);
  compileOtherLights(gl, scene, camera, [scene], target);
  compileFading(gl, scene, camera, target);
  await settle(gl);
  keepPrograms(gl);
}

/**
 * Every program the island has now stays for the session. three deletes a program when the last material using it is
 * disposed, so a thing remounted later (a picked flower's respawn, a node back in view) linked its program again on
 * first sight (measured: 146 ms, a flower's petals, a minute into play).
 */
function keepPrograms(gl: THREE.WebGLRenderer) {
  for (const p of gl.info.programs ?? []) (p as unknown as { usedTimes: number }).usedTimes++;
}

/**
 * Nothing of the scene is drawn behind the loading screen until the warm-up has compiled it: a draw links each program
 * it meets there and then, one after another (measured: 139 programs in the first frames, 1.2 s), where the warm-up's
 * compile has them all link side by side (~95 in 0.14 s). Other renders (an environment map, a pass's quad) go on.
 * What the frame would have drawn into is noted, for the compile (`asDrawn`).
 */
function holdDraws(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const render = gl.render;
  const held: { target: Target; release: () => void } = { target: undefined, release: () => { gl.render = render; } };
  gl.render = (s, camera) => {
    if (s !== scene) return render.call(gl, s, camera);
    if (held.target === undefined) held.target = gl.getRenderTarget();
  };
  return held;
}

export function WarmupProbe({ onReady }: { onReady: () => void }) {
  const framesRef = useRef(0);
  const firedRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const compile = useRef<{ done: boolean } | null>(null);
  const held = useRef<ReturnType<typeof holdDraws> | null>(null);
  useEffect(() => () => held.current?.release(), []);

  useFrame(({ gl, scene, camera }) => {
    if (firedRef.current) return;
    if (startRef.current === null) startRef.current = performance.now();
    held.current ??= holdDraws(gl, scene);
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
      void warmHidden(gl, scene, camera, held.current.target).catch(() => {}).finally(() => { job.done = true; held.current?.release(); });
    }
    framesRef.current = warmupFrame(framesRef.current, loaded, timedOut, !!compile.current && !compile.current.done);
    setLoadPart("warm", framesRef.current / WARMUP_FRAMES); // the loading screen's last stretch
    if (timedOut) held.current.release();
    if (warmedUp(framesRef.current)) {
      firedRef.current = true;
      held.current.release();
      // Defer out of the R3F frame loop: firing setState synchronously here
      // can land mid-render of a just-resolved suspended GLB component
      // ("Cannot update a component while rendering a different component").
      window.setTimeout(() => { onReady(); enterWorld(); }, 0);
    }
  });
  return null;
}
