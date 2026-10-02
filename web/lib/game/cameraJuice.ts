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

import { readComfort, shakeScale } from "./comfortSettings";

let punchDeg = 0, widenDeg = 0, holdDeg = 0;
let shake = 0, shakeT = 0, kickX = 0;
const SHAKE_DECAY = 16; // exponential /s: a shake is gone in ~0.25 s
let shakeDecay = SHAKE_DECAY;
let tension = 0;

const PUNCH_DECAY = 5; // exponential /s — a 4° punch fades in ~0.5s
const TENSION_DEG = 2; // max sustained creep

export function punchZoom(deg: number): void {
  punchDeg = Math.max(punchDeg, deg);
}

export function setTensionZoom(v: number): void {
  tension = Math.max(0, Math.min(1, v));
}

/**
 * A camera shake (combat hits), `amount` world units at its start, scaled by the Screen shake setting (Off by
 * default with reduced motion). `decay` per second (the ult's heavy shake eases at 9/s); `kick` a push to one side
 * that eases out with it (the ult's 0.15 u along the hit).
 */
export function shakeCamera(amount: number, decay = SHAKE_DECAY, kick = 0): void {
  const k = shakeScale(readComfort().screenShake);
  if (!k) return;
  if (amount * k >= shake) { shake = amount * k; shakeDecay = decay; }
  kickX += kick * k;
}
/** A brief FOV widening (the heavy tier's +1.5°), decaying like the punch. */
export function widenFov(deg: number): void { widenDeg = Math.max(widenDeg, deg); }
/** A held FOV offset (the ult sequence: −3° push-in, +5° at the freeze): positive widens; 0 lets go. */
export function holdFov(deg: number): void { holdDeg = deg; }

/** Called once per frame by the follow camera: the shake's offset (screen x, y in world units), decaying. */
export function juiceShake(delta: number, out: { x: number; y: number }): void {
  shake *= Math.exp(-shakeDecay * delta);
  if (shake < 0.002) { shake = 0; shakeDecay = SHAKE_DECAY; }
  kickX *= Math.exp(-shakeDecay * delta);
  if (Math.abs(kickX) < 0.002) kickX = 0;
  shakeT += delta;
  out.x = shake * Math.sin(shakeT * 71) + kickX;
  out.y = shake * Math.sin(shakeT * 53 + 1.3);
}

/** Called once per frame by the FOV pass; decays the punch and returns
 *  the current total zoom-in offset in degrees. */
export function juiceFovOffset(delta: number): number {
  punchDeg *= Math.exp(-PUNCH_DECAY * delta);
  if (punchDeg < 0.01) punchDeg = 0;
  widenDeg *= Math.exp(-PUNCH_DECAY * delta);
  if (widenDeg < 0.01) widenDeg = 0;
  return punchDeg + tension * TENSION_DEG - widenDeg - holdDeg;
}
