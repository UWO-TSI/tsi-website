"use client";

/**
 * Camera juice (David ask, 2026-07-23) — micro-zoom impulses the whole
 * game can fire, consumed by PlayerAvatar's per-frame FOV pass.
 *
 *   punchZoom(deg)      — transient punch-in (bite!, MAX CAST, reveal
 *                         crack). Decays exponentially over ~0.4s.
 *   setTensionZoom(0-1) — sustained creep-in while the reel fish sits in
 *                         the bar (up to TENSION_DEG). Reset on reel end.
 *
 * Plain module store, no React: DOM overlays (fishing) write, the R3F
 * frame loop reads. Zoom IN = the offset is SUBTRACTED from the target
 * FOV.
 */

let punchDeg = 0;
let shake = 0, shakeT = 0;
const SHAKE_DECAY = 16; // exponential /s: a shake is gone in ~0.25 s
let tension = 0;

const PUNCH_DECAY = 5; // exponential /s — a 4° punch fades in ~0.5s
const TENSION_DEG = 2; // max sustained creep

export function punchZoom(deg: number): void {
  punchDeg = Math.max(punchDeg, deg);
}

export function setTensionZoom(v: number): void {
  tension = Math.max(0, Math.min(1, v));
}

/** A small camera shake (combat hits), `amount` world units at its start; never with reduced motion. */
export function shakeCamera(amount: number): void {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  shake = Math.max(shake, amount);
}

/** Called once per frame by the follow camera: the shake's offset (screen x, y in world units), decaying. */
export function juiceShake(delta: number, out: { x: number; y: number }): void {
  shake *= Math.exp(-SHAKE_DECAY * delta);
  if (shake < 0.002) shake = 0;
  shakeT += delta;
  out.x = shake * Math.sin(shakeT * 71);
  out.y = shake * Math.sin(shakeT * 53 + 1.3);
}

/** Called once per frame by the FOV pass; decays the punch and returns
 *  the current total zoom-in offset in degrees. */
export function juiceFovOffset(delta: number): number {
  punchDeg *= Math.exp(-PUNCH_DECAY * delta);
  if (punchDeg < 0.01) punchDeg = 0;
  return punchDeg + tension * TENSION_DEG;
}
