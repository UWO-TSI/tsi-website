import * as THREE from "three";

/**
 * envLight (P3 polish 2026-07-13) — the ACNH "cozy reflections" pass.
 *
 * ACNH's warmth comes from image-based lighting: every prop sits in a
 * bright sky-colored light field with a hot sun spot, so surfaces pick up
 * soft colored reflections instead of flat diffuse. Three.js equivalent:
 * scene.environment from a PMREM. We bake a tiny equirect (64x32 canvas —
 * sky gradient, warm sun blob, ground bounce) from the current
 * time-of-day palette and regenerate only when the phase changes
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
}

// Lighting v3 (2026-07-14 lab): env trimmed with the other fills so the
// stronger sun's shadows survive — see TOD_KEYS note in GameWorld.
export const ENV_PHASES: Record<"dawn" | "day" | "dusk" | "night", EnvPhaseSpec> = {
  dawn: { skyTop: "#C8BCFF", skyBottom: "#FFDDB8", sun: "#FFD9B0", ground: "#7BA55E", intensity: 0.4, sunElev: 0.22 },
  day: { skyTop: "#4FB6F5", skyBottom: "#A9DCF2", sun: "#FFFDF4", ground: "#84CB47", intensity: 0.4, sunElev: 0.6 },
  dusk: { skyTop: "#2D2D6B", skyBottom: "#FFD4A8", sun: "#FF9966", ground: "#6E8A50", intensity: 0.5, sunElev: 0.16 },
  night: { skyTop: "#0E0E28", skyBottom: "#2D2D6B", sun: "#AAB4E8", ground: "#2E4A38", intensity: 0.22, sunElev: 0.4 },
};

let _pmrem: THREE.PMREMGenerator | null = null;
let _currentRT: THREE.WebGLRenderTarget | null = null;
let _appliedPhase: string | null = null;

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
  // sun blob: hot core + warm halo
  const sx = w * 0.3;
  const sy = h / 2 - spec.sunElev * (h / 2);
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
  halo.addColorStop(0, spec.sun);
  halo.addColorStop(0.35, spec.sun + "");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 8, sy - 8, 16, 16);
  ctx.globalAlpha = 1;
  return cv;
}

/** Regenerate + apply the environment for a phase. No-op if unchanged. */
export function applyEnvironment(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  phase: "dawn" | "day" | "dusk" | "night",
): void {
  if (_appliedPhase === phase && scene.environment) return;
  if (!_pmrem) _pmrem = new THREE.PMREMGenerator(gl);
  const spec = ENV_PHASES[phase];
  const tex = new THREE.CanvasTexture(paintEquirect(spec));
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const rt = _pmrem.fromEquirectangular(tex);
  tex.dispose();
  const old = _currentRT;
  scene.environment = rt.texture;
  scene.environmentIntensity = spec.intensity;
  _currentRT = rt;
  _appliedPhase = phase;
  if (old) old.dispose();
}

export function disposeEnvironment(scene: THREE.Scene): void {
  scene.environment = null;
  if (_currentRT) {
    _currentRT.dispose();
    _currentRT = null;
  }
  _appliedPhase = null;
}
