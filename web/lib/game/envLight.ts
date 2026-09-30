import * as THREE from "three";

/**
 * envLight (P3 polish 2026-07-13) — the ACNH "cozy reflections" pass.
 *
 * ACNH's warmth comes from image-based lighting: every prop sits in a
 * bright sky-colored light field with a hot sun spot, so surfaces pick up
 * soft colored reflections instead of flat diffuse. Three.js equivalent:
 * scene.environment from a PMREM. We bake a tiny equirect (64x32 canvas —
 * sky gradient, warm sun blob, ground bounce) from the phase's palette
 * (islandLighting) and regenerate only when it changes
 * (4x/day), not per frame. ~10ms per regen, zero per-frame cost.
 *
 * Module functions (not hooks): the react-compiler freezes hook-returned
 * three objects, and this mutates renderer/scene state directly.
 */

export interface EnvPhaseSpec {
  skyTop: string;
  skyBottom: string;
  sun: string;
  ground: string;
  intensity: number;
  sunElev: number; // 0..1, fraction of height from horizon
  /** Degrees, 0 = +x, 90 = +z (lookPreset sunAngles): puts the blob where the key light is, so glass and metal reflect the sun on the right side. Absent = the painted default. */
  sunAzimuth?: number;
}

const environments = new WeakMap<THREE.Scene, {
  renderer: THREE.WebGLRenderer;
  spec: EnvPhaseSpec;
  target: THREE.WebGLRenderTarget;
}>();

function paintEquirect(spec: EnvPhaseSpec): HTMLCanvasElement {
  const w = 64;
  const h = 32;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  // sky: top -> horizon gradient over the upper half
  const sky = ctx.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, spec.skyTop);
  sky.addColorStop(1, spec.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h / 2);
  // ground bounce fills the lower half (grass-colored light from below)
  const gnd = ctx.createLinearGradient(0, h / 2, 0, h);
  gnd.addColorStop(0, spec.skyBottom);
  gnd.addColorStop(0.25, spec.ground);
  gnd.addColorStop(1, spec.ground);
  ctx.fillStyle = gnd;
  ctx.fillRect(0, h / 2, w, h / 2);
  // sun blob: hot core + warm halo, drawn again one width over so it wraps the seam
  const sx = spec.sunAzimuth === undefined ? w * 0.3 : w * sunU(spec.sunAzimuth);
  const sy = h / 2 - spec.sunElev * (h / 2);
  ctx.globalAlpha = 0.9;
  for (const x of [sx - w, sx, sx + w]) {
    const halo = ctx.createRadialGradient(x, sy, 0, x, sy, 7);
    halo.addColorStop(0, spec.sun);
    halo.addColorStop(0.35, spec.sun + "");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - 8, sy - 8, 16, 16);
  }
  ctx.globalAlpha = 1;
  return cv;
}

/** Equirect u (0-1) of a world azimuth in degrees; three samples u = atan(z, x) / 2π + 0.5. */
export function sunU(azimuth: number): number {
  return (((azimuth / 360 + 0.5) % 1) + 1) % 1;
}

/** Regenerate + apply the environment for a phase's palette (IslandLight.environment). No-op if unchanged. */
export function applyEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene, spec: EnvPhaseSpec): void {
  const current = environments.get(scene);
  if (current?.renderer === gl && current.spec === spec && scene.environment === current.target.texture) return;
  // PMREM generators retain their renderer. Keep one only for this synchronous
  // bake so a remounted Canvas cannot reuse the previous renderer's resources.
  const generator = new THREE.PMREMGenerator(gl);
  let tex: THREE.CanvasTexture | null = null;
  let target: THREE.WebGLRenderTarget;
  try {
    tex = new THREE.CanvasTexture(paintEquirect(spec));
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    target = generator.fromEquirectangular(tex);
  } finally {
    tex?.dispose();
    generator.dispose();
  }
  scene.environment = target.texture;
  scene.environmentIntensity = spec.intensity;
  environments.set(scene, { renderer: gl, spec, target });
  current?.target.dispose();
}

export function disposeEnvironment(scene: THREE.Scene): void {
  const current = environments.get(scene);
  if (!current) return;
  if (scene.environment === current.target.texture) {
    scene.environment = null;
    scene.environmentIntensity = 1;
  }
  current.target.dispose();
  environments.delete(scene);
}
