/**
 * One screen-space layout for the world's labels (world audit item 2): the other players' nameplates, the landmark
 * tags, and (group C wires them) the residents' names and bubbles. Every frame, after it is drawn with the camera
 * final, each label is projected through the curved world's bend, then:
 *
 * - **Occlusion.** A label whose line of sight from the camera crosses a building (the scene's occluders,
 *   lib/game/occluders.ts) fades out, so a plate behind the café no longer floats on its wall.
 * - **Range.** A label with a `range` (the landmark tags) shows only within that distance of the focus (you), fading
 *   over the last `FADE_RUN`, so far tags don't hang in the sky as specks.
 * - **Declutter.** By priority, then nearest first, each label takes its place; one that would overlap a label already
 *   placed is nudged up above it (a plate) or fades out (a tag). A plate pushed further than `MAX_NUDGE` of its own
 *   heights shrinks to a dot.
 *
 * The nudge and the fades ease, so plates crossing each other slide rather than jump. Nothing is allocated per frame:
 * entries and their order live in arrays that grow only when a label is added.
 *
 * Using it: `worldLabels.add({ priority, anchor, size, place, ... })` returns the removal. `anchor` writes the label's
 * world point each frame (false: not showing now); `size` is its box in CSS px, measured by the owner when its text
 * changes; `place` gets the result (`LabelOut`) after each solve and writes the DOM. A drei `<Html>` label (positioned by
 * drei) applies only `dy`, `alpha` and `dot`; a pooled element (Nameplates) also moves itself to `x`, `y + dy`.
 * `<LabelLayer>` (components/game/LabelLayer.tsx) runs the solve; scenes hand it their building occluders.
 */
import * as THREE from "three";
import { bendViewPoint } from "./worldProjection";
import type { Occluder } from "./occluders";

/** Who keeps their place when two labels meet: the higher one. */
export const LABEL_PRIORITY = { landmark: 0, resident: 1, player: 2, speech: 3, self: 4 } as const;

/** The world distance over which a ranged label fades in or out. */
export const FADE_RUN = 2;
/** How far (in its own heights) a label may be nudged up before it shrinks to a dot. */
export const MAX_NUDGE = 2.5;
/** Space kept between two stacked labels (CSS px). */
export const LABEL_GAP = 3;
/** The line of sight stops this short of the label (world units), so the building a tag belongs to doesn't hide it. */
const SIGHT_PULL = 0.4;
/** Easing rates (per second) for the nudge and the fades. */
const NUDGE_RATE = 14, FADE_RATE = 10;

export interface LabelOut {
  /** The anchor's projection, CSS px from the canvas's top left. */
  x: number; y: number;
  /** The nudge up (0 or negative, CSS px), eased: add it to y. */
  dy: number;
  /** Distance in front of the camera, for stacking. */
  depth: number;
  /** 0–1: the range and occlusion fades, eased. */
  alpha: number;
  /** Squeezed out: a dot (a nudging label) or hidden (one that doesn't nudge). */
  dot: boolean;
  /** Showing at all this frame: anchored, in front of the camera and not faded out. */
  shown: boolean;
}

export interface LabelSpec {
  /** LABEL_PRIORITY: the higher keeps its place. */
  priority: number;
  /** The label's world point now, into `out`; false while it isn't showing (unassigned, out of the scene). */
  anchor(out: THREE.Vector3): boolean;
  /** Its box in CSS px, centred on the anchor's projection; read every solve, so the owner updates it in place. */
  size: { w: number; h: number };
  /** Stacked up out of a nearer label's way (default); false: it fades out instead (the landmark tags). */
  nudge?: boolean;
  /** Fades out behind a building (default true). */
  occlude?: boolean;
  /** Shows only within this distance of the focus (world units, on the ground), fading over the last FADE_RUN. */
  range?: number;
  /** drei's `distanceFactor` for a label drei scales: its box scales with distance as drei's does. */
  distanceFactor?: number;
  /** The result, after each solve. */
  place(out: Readonly<LabelOut>): void;
}

interface Entry {
  spec: LabelSpec;
  out: LabelOut;
  /** Wanted this frame: the eased values chase these. */
  dyTarget: number; alphaTarget: number;
  /** Its box this frame (CSS px, before the nudge) and the scale drei draws it at. */
  w: number; h: number; scale: number;
  live: boolean;
  /** Placed in the declutter pass (its box blocks later labels). */
  placed: boolean;
}

const point = new THREE.Vector3(), eye = new THREE.Vector3(), world = new THREE.Vector3();

/** Whether the segment a→a+d (t in 0–1) passes through the occluder's box: the slab test, with no arrays. */
function crosses(o: Occluder, ax: number, ay: number, az: number, dx: number, dy: number, dz: number): boolean {
  let t0 = 0, t1 = 1;
  // x
  if (Math.abs(dx) < 1e-9) { if (ax < o.x - o.hx || ax > o.x + o.hx) return false; }
  else { let u = (o.x - o.hx - ax) / dx, v = (o.x + o.hx - ax) / dx; if (u > v) { const w = u; u = v; v = w; } t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  // y
  if (Math.abs(dy) < 1e-9) { if (ay < o.y0 || ay > o.y1) return false; }
  else { let u = (o.y0 - ay) / dy, v = (o.y1 - ay) / dy; if (u > v) { const w = u; u = v; v = w; } t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  // z
  if (Math.abs(dz) < 1e-9) { if (az < o.z - o.hz || az > o.z + o.hz) return false; }
  else { let u = (o.z - o.hz - az) / dz, v = (o.z + o.hz - az) / dz; if (u > v) { const w = u; u = v; v = w; } t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  return true;
}

/** Whether a building stands between the eye and the point, stopping SIGHT_PULL short of the point. */
export function sightBlocked(e: THREE.Vector3Like, p: THREE.Vector3Like, occluders: readonly Occluder[]): boolean {
  const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, run = Math.hypot(dx, dy, dz);
  if (run <= SIGHT_PULL) return false;
  const k = (run - SIGHT_PULL) / run;
  for (let i = 0; i < occluders.length; i++) if (crosses(occluders[i], e.x, e.y, e.z, dx * k, dy * k, dz * k)) return true;
  return false;
}

/** Overlap of two boxes given as centre x, top, width, height. */
const overlaps = (ax: number, at: number, aw: number, ah: number, bx: number, bt: number, bw: number, bh: number) =>
  Math.abs(ax - bx) * 2 < aw + bw && at < bt + bh && bt < at + ah;

export class LabelLayout {
  private entries: Entry[] = [];
  /** Live entries in placing order (priority, then nearest first), reused every frame. */
  private order: Entry[] = [];
  private occluders: readonly Occluder[] = [];

  /** Register a label; returns its removal. */
  add(spec: LabelSpec): () => void {
    const entry: Entry = { spec, out: { x: 0, y: 0, dy: 0, depth: 0, alpha: 0, dot: false, shown: false }, dyTarget: 0, alphaTarget: 0, w: 0, h: 0, scale: 1, live: false, placed: false };
    this.entries.push(entry);
    return () => {
      const i = this.entries.indexOf(entry);
      if (i >= 0) this.entries.splice(i, 1);
    };
  }

  /** The scene's buildings (boxes from the ground up); [] where nothing hides a label. */
  setOccluders(list: readonly Occluder[]) { this.occluders = list; }

  get size() { return this.entries.length; }

  /**
   * Lay every label out for this frame and hand each its result. `focus`: the player (for ranges); `dt`: seconds since
   * the last solve (0 snaps the eased values).
   */
  solve(camera: THREE.Camera, width: number, height: number, focus: THREE.Vector3Like, dt: number) {
    const cam = camera as THREE.PerspectiveCamera, near = cam.near ?? 0;
    const fovScale = cam.isPerspectiveCamera ? 2 * Math.tan((cam.fov * Math.PI) / 360) : 0;
    eye.setFromMatrixPosition(camera.matrixWorld);
    const nudgeK = dt > 0 ? 1 - Math.exp(-NUDGE_RATE * dt) : 1, fadeK = dt > 0 ? 1 - Math.exp(-FADE_RATE * dt) : 1;
    const order = this.order;
    order.length = 0;

    // 1. Project; the range and occlusion fades.
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i], s = e.spec, o = e.out;
      const was = e.live;
      e.live = false; e.placed = false; e.alphaTarget = 0;
      if (!s.anchor(point)) continue;
      world.copy(point);
      const wx = point.x, wy = point.y, wz = point.z;
      point.applyMatrix4(camera.matrixWorldInverse);
      if (point.z > -near) continue;
      o.depth = -point.z;
      bendViewPoint(point).applyMatrix4(camera.projectionMatrix);
      o.x = ((point.x + 1) * width) / 2;
      o.y = ((1 - point.y) * height) / 2;
      e.scale = s.distanceFactor && fovScale ? s.distanceFactor / (fovScale * Math.hypot(wx - eye.x, wy - eye.y, wz - eye.z)) : 1;
      e.w = s.size.w * e.scale; e.h = s.size.h * e.scale;
      // Off the page (with a box's margin): nothing to lay out.
      if (o.x < -e.w || o.x > width + e.w || o.y < -e.h || o.y > height + e.h) continue;
      let alpha = 1;
      if (s.range !== undefined) alpha = Math.min(1, Math.max(0, (s.range + FADE_RUN - Math.hypot(wx - focus.x, wz - focus.z)) / FADE_RUN));
      if (alpha > 0 && s.occlude !== false && this.occluders.length && sightBlocked(eye, world, this.occluders)) alpha = 0;
      e.alphaTarget = alpha;
      e.live = true;
      // Newly showing: no slide in from an old nudge.
      if (!was) { o.dy = 0; e.dyTarget = 0; }
      // Insert by priority (high first), then depth (near first): insertion sort, no allocation.
      let k = order.length;
      order.push(e);
      while (k > 0) {
        const p = order[k - 1];
        if (p.spec.priority > s.priority || (p.spec.priority === s.priority && p.out.depth <= o.depth)) break;
        order[k] = p; k--;
      }
      order[k] = e;
    }

    // 2. Declutter: each takes its place in order; an overlap nudges it above, or squeezes it out.
    for (let i = 0; i < order.length; i++) {
      const e = order[i], o = e.out;
      o.dot = false;
      // A label on its way out (faded, behind a wall) takes no room.
      if (e.alphaTarget <= 0) { e.dyTarget = 0; continue; }
      const top0 = o.y - e.h / 2;
      let dy = 0, hit = true;
      for (let pass = 0; pass < 8 && hit; pass++) {
        hit = false;
        for (let j = 0; j < i; j++) {
          const p = order[j];
          if (!p.placed) continue;
          const pt = p.out.y + p.dyTarget - p.h / 2;
          if (overlaps(o.x, top0 + dy, e.w, e.h, p.out.x, pt, p.w, p.h)) { hit = true; dy = pt - LABEL_GAP - e.h - top0; }
        }
        if (hit && e.spec.nudge === false) break;
      }
      if (hit || -dy > MAX_NUDGE * e.h) { o.dot = true; e.dyTarget = 0; continue; }
      e.dyTarget = dy;
      e.placed = true;
    }

    // 3. Ease and hand out.
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i], o = e.out;
      if (!e.live) {
        if (o.shown) { o.shown = false; o.alpha = 0; o.dot = false; e.spec.place(o); }
        continue;
      }
      // A label that doesn't nudge has nothing to show as a dot: it fades out.
      const target = o.dot && e.spec.nudge === false ? 0 : e.alphaTarget;
      o.alpha += (target - o.alpha) * fadeK;
      if (o.alpha < 0.01 && target === 0) o.alpha = 0;
      o.dy += (e.dyTarget - o.dy) * nudgeK;
      o.shown = o.alpha > 0;
      e.spec.place(o);
    }
  }
}

/** The world's labels: one layout for every scene (the scene sets its occluders). */
export const worldLabels = new LabelLayout();
