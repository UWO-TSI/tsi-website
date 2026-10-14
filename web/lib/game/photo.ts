/**
 * Photo mode's pure parts (specs/v1-drop.md §3, §9: "Photo mode: P key or a camera icon", save to device; postcards by
 * mail are v1.1): the filters, the frames, the free camera and the snap's size and name. The live view and the saved
 * photo agree: a filter is a list of CSS filter functions, which the live view hands the canvas as a CSS filter (the
 * compositor's, no pass of our own) and the snap composes into one colour matrix (the Filter Effects spec's own
 * matrices) and runs over the pixels, so it looks the same in every browser; its overlays (a tint, a glow, the
 * vignette, the grain) are gradients both draw the same way.
 */
import * as THREE from "three";
import type { Occluder } from "./occluders";

// ── Filters ───────────────────────────────────────────────────────

export type FilterFn = readonly ["sepia" | "saturate" | "contrast" | "brightness" | "grayscale" | "hue-rotate", number];
export interface PhotoFilter {
  id: string;
  name: string;
  /** CSS filter functions, in order (hue-rotate in degrees). */
  fns: readonly FilterFn[];
  /** A colour laid over the photo with a blend mode (soft-light, screen or multiply), at `alpha`. */
  tint?: { color: string; alpha: number; blend: "soft-light" | "screen" | "multiply" };
  /** A warm light from the middle (screen), at `alpha`. */
  glow?: { color: string; alpha: number };
  /** How dark the corners go, 0..1. */
  vignette?: number;
  /** Film grain, 0..1. */
  grain?: number;
}
/** The natural look and the six filters (David's list, 2026-10-13). */
export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  { id: "none", name: "Natural", fns: [] },
  { id: "soft", name: "Soft film", fns: [["contrast", 0.92], ["saturate", 0.88], ["brightness", 1.04], ["sepia", 0.12]],
    tint: { color: "#fff1d6", alpha: 0.18, blend: "soft-light" }, vignette: 0.22, grain: 0.05 },
  { id: "golden", name: "Golden", fns: [["sepia", 0.32], ["saturate", 1.25], ["brightness", 1.05], ["contrast", 1.02], ["hue-rotate", -8]],
    tint: { color: "#ffb347", alpha: 0.26, blend: "soft-light" }, glow: { color: "#ffd98a", alpha: 0.16 }, vignette: 0.18 },
  { id: "mono", name: "Mono", fns: [["grayscale", 1], ["contrast", 1.12], ["brightness", 1.03]], vignette: 0.28, grain: 0.06 },
  { id: "pastel", name: "Pastel", fns: [["saturate", 0.7], ["brightness", 1.1], ["contrast", 0.86]], tint: { color: "#ffd6f0", alpha: 0.12, blend: "screen" } },
  { id: "night", name: "Night glow", fns: [["brightness", 0.82], ["contrast", 1.1], ["saturate", 1.2], ["hue-rotate", 12]],
    tint: { color: "#3b4a9a", alpha: 0.25, blend: "multiply" }, glow: { color: "#ffd27a", alpha: 0.18 }, vignette: 0.35 },
  { id: "polaroid", name: "Polaroid", fns: [["sepia", 0.18], ["contrast", 0.9], ["saturate", 0.95], ["brightness", 1.06]],
    tint: { color: "#5ec8c0", alpha: 0.12, blend: "soft-light" }, vignette: 0.15, grain: 0.04 },
];
export const filterById = (id: string) => PHOTO_FILTERS.find(f => f.id === id) ?? PHOTO_FILTERS[0];

/** The live view's CSS filter. */
export function cssFilter(fns: readonly FilterFn[]): string {
  return fns.length ? fns.map(([fn, v]) => `${fn}(${v}${fn === "hue-rotate" ? "deg" : ""})`).join(" ") : "none";
}

/** A 4×5 colour matrix, row-major as feColorMatrix (rows r, g, b, a; columns r, g, b, a, offset in 0..1). */
export type Matrix = number[];
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
/** One CSS filter function as its matrix (Filter Effects Module Level 1 §13.1). */
function fnMatrix([fn, v]: FilterFn): Matrix {
  switch (fn) {
    case "grayscale": {
      const a = 1 - Math.min(1, v);
      return [0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0, 0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0, 0, 0, 0, 0, 1, 0];
    }
    case "sepia": {
      const a = 1 - Math.min(1, v);
      return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0, 0, 0, 0, 0, 1, 0];
    }
    case "saturate":
      return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0,
        0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0, 0, 0, 0, 0, 1, 0];
    case "hue-rotate": {
      const r = (v * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0, 0, 0, 0, 1, 0];
    }
    case "brightness":
      return [v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, 1, 0];
    case "contrast": {
      const o = 0.5 - 0.5 * v;
      return [v, 0, 0, 0, o, 0, v, 0, 0, o, 0, 0, v, 0, o, 0, 0, 0, 1, 0];
    }
  }
}
/** b after a: the matrix that does a, then b. */
function then(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let s = c === 4 ? b[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) s += b[r * 5 + k] * a[k * 5 + c];
      out[r * 5 + c] = s;
    }
  }
  return out;
}
/** The filter functions, in order, as one matrix. */
export function composeMatrix(fns: readonly FilterFn[]): Matrix {
  return fns.reduce((m, fn) => then(m, fnMatrix(fn)), IDENTITY.slice());
}
/** Run a matrix over RGBA pixels in place (alpha left as it is; each channel clamped as the browser does). */
export function applyMatrix(data: Uint8ClampedArray, m: Matrix): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, a = data[i + 3] / 255;
    data[i] = Math.round(Math.min(1, Math.max(0, m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4])) * 255);
    data[i + 1] = Math.round(Math.min(1, Math.max(0, m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9])) * 255);
    data[i + 2] = Math.round(Math.min(1, Math.max(0, m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14])) * 255);
  }
}

// ── Frames ────────────────────────────────────────────────────────

export type FrameId = "plain" | "polaroid" | "postcard" | "tsi";
export const PHOTO_FRAMES: readonly { id: FrameId; name: string }[] = [
  { id: "plain", name: "Plain" }, { id: "polaroid", name: "Polaroid" }, { id: "postcard", name: "Postcard" }, { id: "tsi", name: "TSI" },
];
export interface FrameLayout {
  width: number; height: number;
  photo: { x: number; y: number; w: number; h: number };
  /** Where a caption line sits (the polaroid's, the TSI band's), its baseline and text size. */
  caption?: { x: number; y: number; size: number };
}
/** The framed image for a w × h photo: borders in proportion to the photo's long side. */
export function frameLayout(id: FrameId, w: number, h: number): FrameLayout {
  const long = Math.max(w, h), b = (k: number) => Math.round(long * k);
  switch (id) {
    case "plain": { const p = b(0.03); return { width: w + 2 * p, height: h + 2 * p, photo: { x: p, y: p, w, h } }; }
    case "polaroid": {
      const p = b(0.045), foot = b(0.17);
      return { width: w + 2 * p, height: h + p + foot, photo: { x: p, y: p, w, h }, caption: { x: p, y: p + h + Math.round(foot * 0.58), size: Math.round(foot * 0.26) } };
    }
    case "postcard": { const p = b(0.06); return { width: w + 2 * p, height: h + 2 * p, photo: { x: p, y: p, w, h } }; }
    case "tsi": {
      const p = b(0.035), band = b(0.085);
      return { width: w + 2 * p, height: h + p + band, photo: { x: p, y: p, w, h }, caption: { x: p, y: p + h + Math.round(band * 0.62), size: Math.round(band * 0.36) } };
    }
  }
}

// ── The free camera ───────────────────────────────────────────────

/** Orbit (radians, world units): a little below level to looking straight down, near to far. */
export const PHOTO_CAMERA = { pitchMin: -0.12, pitchMax: 1.45, distMin: 1.6, distMax: 22, selfieDist: 2.2, selfieUp: 0.3, selfieSwingMax: 0.9 } as const;
export interface Orbit { yaw: number; pitch: number; dist: number }
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
export function clampOrbit(o: Orbit): Orbit {
  return {
    yaw: wrap(o.yaw),
    pitch: Math.min(PHOTO_CAMERA.pitchMax, Math.max(PHOTO_CAMERA.pitchMin, o.pitch)),
    dist: Math.min(PHOTO_CAMERA.distMax, Math.max(PHOTO_CAMERA.distMin, o.dist)),
  };
}
/** Where the camera is for an orbit round `at` (yaw 0 looks toward +z, as the follow camera's default view does). */
export function orbitPose(at: THREE.Vector3, yaw: number, pitch: number, dist: number, out: THREE.Vector3): THREE.Vector3 {
  const h = Math.cos(pitch) * dist;
  return out.set(at.x - Math.sin(yaw) * h, at.y + Math.sin(pitch) * dist, at.z - Math.cos(yaw) * h);
}
/**
 * A selfie: the camera at arm's length in front of you (your `yaw` faces +z at 0, as the rig does), swung `swing`
 * radians round you, held a little high, looking back at your face.
 */
export function selfiePose(head: THREE.Vector3, yaw: number, swing: number, pos: THREE.Vector3, look: THREE.Vector3): void {
  const a = yaw + Math.max(-PHOTO_CAMERA.selfieSwingMax, Math.min(PHOTO_CAMERA.selfieSwingMax, swing));
  pos.set(head.x + Math.sin(a) * PHOTO_CAMERA.selfieDist, head.y + PHOTO_CAMERA.selfieUp, head.z + Math.cos(a) * PHOTO_CAMERA.selfieDist);
  // A little above the eyes, so the face sits in the top half with the shoulders below it.
  look.set(head.x, head.y + 0.12, head.z);
}

/**
 * How far along at→pos the camera may go before a building (0..1; 1: nothing in the way): the first box the segment
 * enters. Tree crowns (`canopy`) don't stop it. Allocates nothing.
 */
export function firstHit(at: THREE.Vector3Like, pos: THREE.Vector3Like, occluders: readonly Occluder[]): number {
  const dx = pos.x - at.x, dy = pos.y - at.y, dz = pos.z - at.z;
  let best = 1;
  for (let i = 0; i < occluders.length; i++) {
    const o = occluders[i];
    if (o.canopy) continue;
    let t0 = 0, t1 = 1, out = false;
    for (let k = 0; k < 3 && !out; k++) {
      const p = k === 0 ? at.x : k === 1 ? at.y : at.z, d = k === 0 ? dx : k === 1 ? dy : dz;
      const lo = k === 0 ? o.x - o.hx : k === 1 ? o.y0 : o.z - o.hz, hi = k === 0 ? o.x + o.hx : k === 1 ? o.y1 : o.z + o.hz;
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) out = true; continue; }
      let u = (lo - p) / d, v = (hi - p) / d;
      if (u > v) { const w = u; u = v; v = w; }
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 > t1) out = true;
    }
    if (!out && t0 < best) best = t0;
  }
  return best;
}

// ── The snap ──────────────────────────────────────────────────────

/** How many photo pixels per canvas pixel: about your screen's size (2× at most per CSS pixel), whole numbers (the
 *  pixel look stays crisp), never below 1, at most 2560 wide. */
export function photoScale(canvasW: number, cssW: number, dpr: number): number {
  const want = Math.min(2560, cssW * Math.min(2, Math.max(1, dpr)));
  return Math.max(1, Math.floor(want / canvasW));
}
const two = (n: number) => String(n).padStart(2, "0");
export function photoFileName(d: Date): string {
  return `tethos-island-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.png`;
}
