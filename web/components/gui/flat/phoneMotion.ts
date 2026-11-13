/**
 * The phone's numbers (phone.tsx; design bible UI 8d), kept pure so they can be tested: its two motions, where it sits
 * on screen, the layout of its screen, and the map from that screen onto the tilted glass.
 */

// ── The motion (round 12, David: "make it pull out and flip open and not 1 motion") ──────────────────────
/** One spring a motion: `x` 0 (away) to 1 (out, or open), `v` its speed. */
export interface Spring { x: number; v: number }
/** The phone's state: pulled out (`rise`) and flipped open (`slide`, the top half up). The charm swings on its own (below). */
export interface PhoneMotion { rise: Spring; slide: Spring }
export const restMotion = (): PhoneMotion => ({ rise: { x: 0, v: 0 }, slide: { x: 0, v: 0 } });
/** About 12% overshoot (bible UI 9) at these: the pull-out settles in about 0.45 s, the flip in about 0.3 s. */
const RISE = { k: 150, c: 13 }, SLIDE = { k: 340, c: 20 };
/** Pulled out this far, and nearly still, it flips open (the beat between the two motions). */
const OUT_AT = 0.97, STILL = 0.6;

function step(s: Spring, to: number, p: { k: number; c: number }, dt: number) {
  s.v += (p.k * (to - s.x) - p.c * s.v) * dt;
  s.x += s.v * dt;
}
/**
 * One frame (dt seconds) toward `want`: `open` pulls it out, then once it's out flips it open; away, it flips shut,
 * then drops. `tucked` (an app is open) drops it while it stays open, so it comes back as it was. Reduced motion: it is
 * where it's going at once.
 */
export function stepMotion(m: PhoneMotion, want: { open: boolean; tucked?: boolean }, dt: number, reduced = false): PhoneMotion {
  const out = want.open && !want.tucked;
  if (reduced) {
    m.rise = { x: out ? 1 : 0, v: 0 }; m.slide = { x: want.open ? 1 : 0, v: 0 };
    return m;
  }
  // Opening, it flips open once it's out (or stays open, coming back from an app); closing, it drops once it's shut.
  const slideTo = !want.open ? 0 : want.tucked || m.slide.x > 0.5 || (m.rise.x > OUT_AT && Math.abs(m.rise.v) < STILL) ? 1 : 0;
  const riseTo = out ? 1 : want.tucked || m.slide.x < 0.03 ? 0 : m.rise.x > 0.5 ? 1 : 0;
  const h = Math.min(dt, 1 / 15) / 4;  // four steps a frame: steady at a slow frame, and on time
  for (let i = 0; i < 4; i++) { step(m.rise, riseTo, RISE, h); step(m.slide, slideTo, SLIDE, h); }
  return m;
}
/** Where it's going, and nothing moving: it can stop drawing. */
export const settled = (m: PhoneMotion, want: { open: boolean; tucked?: boolean }) =>
  Math.abs(m.rise.x - (want.open && !want.tucked ? 1 : 0)) < 1e-3 && Math.abs(m.slide.x - (want.open ? 1 : 0)) < 1e-3 &&
  Math.abs(m.rise.v) < 1e-3 && Math.abs(m.slide.v) < 1e-3;

// ── Where it sits ──────────────────────────────────────────────────────────────────────────────────────────
/**
 * The view onto the phone, in its own units (the model is 5 wide; the open phone runs from the base's foot at -5.1 to
 * the top half's top at 9.9): room for the strap on the left and the tilt on the right; the bottom edge cuts the
 * keypad's plain foot, as if it's held up from below.
 */
export const VIEW = { left: -4.7, right: 3.3, bottom: -4.1, top: 10.4 } as const;
/** The open phone's top, and how far its right edge sits in from the view's (units). */
const PHONE_TOP = 9.9, PHONE_RIGHT = 2.5;
/**
 * The phone's box on screen (CSS px) for a window: it fits between the window's foot and the top right's HUD (the
 * wallet's slot ends about 380 px down, 280 on a phone screen) and sits 16 px in from the right edge. Every edge is on
 * the world's pixel grid (`px` CSS px a pixel, from the window's corner), so the phone's pixels line up with the
 * island's. In a window too short for the smallest phone it sinks instead, so its top still clears the wallet.
 */
export function phoneBox(vw: number, vh: number, touch: boolean, px: number) {
  const clear = touch ? 290 : 392, edge = 16;
  const fit = (vh - clear) / (PHONE_TOP - VIEW.bottom);
  const k = Math.max(touch ? 30 : 32, Math.min(fit, touch ? 46 : 52, (vw - 2 * edge) / (VIEW.right - VIEW.left)));
  const snap = (n: number) => Math.round(n / px) * px;
  const left = snap(vw - edge - (PHONE_RIGHT - VIEW.left) * k);
  // The box ends at the window's edge (the tilt's room on the right is the 16 px margin).
  const w = Math.min(snap((VIEW.right - VIEW.left) * k), vw - left), h = snap((VIEW.top - VIEW.bottom) * k);
  const sink = Math.max(0, (k - fit) * (PHONE_TOP - VIEW.bottom));
  const top = snap(vh - h + sink);
  /** What the box shows, in the phone's units (the camera frames exactly this). */
  const view = { left: VIEW.left, right: VIEW.left + w / k, bottom: VIEW.top - h / k, top: VIEW.top };
  return { left, top, w, h, k, view };
}

// ── The screen ─────────────────────────────────────────────────────────────────────────────────────────────
/** The screen in its own pixels (the glass is 4.3 by 6.2 units): what the UI is laid out and drawn in. The texture
 * is TEX texture pixels a screen pixel, finer than the glass's CSS pixels, so the sharp pass's light finish is its only one. */
export const SCREEN = { w: 108, h: 156 } as const;
export const TEX = 4;
type Rect = readonly [number, number, number, number];
/**
 * The home screen today's UI way (rounds 12 and 14, David: "current ui but green highlights", "keep it old"): a slim
 * status line, the apps as white cards two across (the icon over its name), and the home bar at the foot.
 */
export function screenLayout(count: number) {
  const pad = 6, gap = 5, bar = 11, home = 12;
  const cols = 2, rows = Math.max(1, Math.ceil(count / cols));
  const cw = Math.floor((SCREEN.w - 2 * pad - gap * (cols - 1)) / cols);
  const ch = Math.min(40, Math.floor((SCREEN.h - bar - home - pad - gap * (rows - 1)) / rows));
  const top = bar + Math.floor((SCREEN.h - bar - home - pad - (rows * ch + gap * (rows - 1))) / 2);
  const tiles: Rect[] = Array.from({ length: count }, (_, i) => [pad + (i % cols) * (cw + gap), top + Math.floor(i / cols) * (ch + gap), cw, ch]);
  return { tiles, bar: [0, 0, SCREEN.w, bar] as Rect, home: [Math.round(SCREEN.w / 2 - 22), SCREEN.h - home + 1, 44, home - 3] as Rect };
}

// ── The screen on the glass ────────────────────────────────────────────────────────────────────────────────
type P = readonly [number, number];
/**
 * The CSS matrix3d that maps a w by h box (origin top left) onto the quad tl, tr, br, bl (CSS px): the projective map
 * of a square onto a quad (Heckbert), so the screen's HTML lies on the tilted glass, under the texture's pixels.
 */
export function quadMatrix(w: number, h: number, [x0, y0]: P, [x1, y1]: P, [x2, y2]: P, [x3, y3]: P): string {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det ? (dx3 * dy2 - dx2 * dy3) / det : 0, hh = det ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map(n => +n.toPrecision(9)).join(",")})`;
}

// ── The corner (round 10, David: "if your mouse hits the bottom right of the screen without clicking it will pop up and hiting it again retracts") ──
/** How close to the window's bottom-right corner the cursor has to come (CSS px each way). */
export const CORNER_PX = 14;
export const inCorner = (x: number, y: number, vw: number, vh: number) => x >= vw - CORNER_PX && y >= vh - CORNER_PX;

// ── The charm (rounds 13 and 14, David: "the charm on the phone is a accessory, and it has proper physics", "the string is not made to physics") ──
export type V3 = [number, number, number];
/**
 * The charm as a short rope: the strap's joints, then the pendant's middle, each a point a fixed length from the one
 * above it (the first from the mount, where it's pinned), swung by gravity and by the mount's own motion (the pull-out,
 * the flip, the lean). The strap's mesh bends along its points (phone.tsx). `p` the points now, `q` a step ago
 * (Verlet), `at` the mount a step ago.
 */
export interface CharmSim { p: V3[]; q: V3[]; len: number[]; at: V3 }
/** Gravity (phone units a second squared: about a 1 s swing on the strap's length) and the air's drag (a second). */
const GRAVITY = 120, DRAG = 2.6, H = 1 / 240;
/** The strap's give (a second): how fast a point's way evens out with the point above it's. */
const GIVE = 8;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
/** Hanging still straight down from the mount. */
export function hangCharm(mount: V3, len: readonly number[]): CharmSim {
  let y = mount[1];
  const p = len.map(l => [mount[0], (y -= l), mount[2]] as V3);
  return { p, q: p.map(v => [...v] as V3), len: [...len], at: [...mount] as V3 };
}
/**
 * One frame (dt seconds) with the mount now at `mount`: fixed steps, the mount eased from where it was, each point
 * pulled back to its length, and `solid` (the phone's body) pushing a point out of it. Reduced motion: it hangs still.
 */
export function stepCharm(s: CharmSim, mount: V3, dt: number, solid?: (p: V3, i: number) => V3 | null, reduced = false): CharmSim {
  if (reduced) return Object.assign(s, hangCharm(mount, s.len));
  const n = Math.max(1, Math.round(Math.min(dt, 1 / 15) / H)), from = s.at;
  let was = from;
  for (let k = 1; k <= n; k++) {
    const m: V3 = [0, 1, 2].map(i => from[i] + (mount[i] - from[i]) * (k / n)) as V3;
    // Each point keeps its way (less the air's drag, and less what it moves apart from the point above it: the strap's
    // own give, so a whip down the rope dies out like a string's), then falls a step.
    let up = sub(m, was);
    s.p.forEach((p, i) => {
      const q = s.q[i], keep = 1 - DRAG * H, give = Math.min(1, GIVE * H);
      const v = [0, 1, 2].map(j => (p[j] - q[j]) * keep) as V3;
      if (i) for (let j = 0; j < 3; j++) v[j] -= (v[j] - up[j]) * give;
      s.q[i] = [...p] as V3;
      s.p[i] = [p[0] + v[0], p[1] + v[1] - GRAVITY * H * H, p[2] + v[2]];
      up = v;
    });
    was = m;
    // Each link pulled back to its length, down from the pin, a few times over so the rope doesn't stretch.
    for (let pass = 0; pass < 4; pass++) s.p.forEach((p, i) => {
      const up = i ? s.p[i - 1] : m, d = sub(p, up), l = len3(d) || 1, f = s.len[i] / l;
      s.p[i] = [up[0] + d[0] * f, up[1] + d[1] * f, up[2] + d[2] * f];
      const out = solid?.(s.p[i], i);
      if (out) s.p[i] = out;
    });
  }
  s.at = [...mount] as V3;
  return s;
}
/** Nearly still (phone units a second). */
export const charmStill = (s: CharmSim) => s.p.every((p, i) => len3(sub(p, s.q[i])) / H < 0.15);
