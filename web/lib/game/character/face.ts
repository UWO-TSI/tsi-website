/**
 * Animated painted face (avatar v7, rows 132, 144, 192, 254): an ACNH-style face the engine animates without
 * redrawing a canvas. The face atlas (art/characters/v7/build_face.py) holds every feature once; the face shader
 * draws the skin colour plus a layer slot per extra (blush band, blush, freckles, mole, set 305's accents), brows, the two eyes and the mouth, each an atlas
 * cell placed at its anchor on the face canvas (the head's UVs), mirrored for the other side where the layer is.
 * Blinking, talking and the six expressions only change which cell each slot shows and the brows' pose.
 * Pure: FaceAnimator picks the frame, faceSlots turns it into slot data, faceMaterial.ts uploads it.
 */
import { FACE, PALETTE, PLACE_STEPS, type CharacterLook, type EyeFrame, type FaceCell, type Placement } from "./look";

export type Expression = "neutral" | "happy" | "surprised" | "sad" | "angry" | "sleepy";
export const EXPRESSIONS: readonly Expression[] = ["neutral", "happy", "surprised", "sad", "angry", "sleepy"];

/** Ruling 23: clip → expression; everything else is neutral (with blinks). */
export const CLIP_EXPRESSION: Record<string, Expression> = {
  Laugh: "happy", Cheer: "happy", Stretch: "happy", Dance: "happy", Sad: "sad", Defeat: "sad", Hit: "surprised", Sleep: "sleepy",
  AttackMelee: "angry", AttackBow: "angry", AttackCast: "angry",
};

/** What one frame of the face shows. brow = [dy (canvas units, + down), tilt (degrees, + raises the inner end)]. */
export interface FacePose { eyes: string; eyeFrame: EyeFrame; mouth: string; brow: [number, number] }
/** Forced parts of the face (dialogue portraits, the avatar bench, evidence captures). */
export interface FaceOverride { expression?: Expression; eyeFrame?: EyeFrame; mouth?: string; talking?: boolean }

const DEPTH: Record<EyeFrame, number> = { open: 0, half: 1, closed: 2 };
const eyeCells = (id: string) => FACE.layers.eyes.items[id] ?? FACE.layers.eyes.items[FACE.layers.eyes.default];
/** An eye style that has blink frames (lidded eyes; the shut ones like E8.1 and "> <" E6.1 do not). */
export const canBlink = (eyes: string) => !!eyeCells(eyes).closed;

/** The resting face of an expression on a look: its eyes (or the look's), frame, mouth and brow pose. */
export function restPose(look: CharacterLook, expression: Expression): FacePose {
  const e = FACE.expressions[expression] ?? FACE.expressions.neutral;
  const eyes = e.eyes ?? look.eyes;
  return { eyes, eyeFrame: eyeCells(eyes)[e.eyeFrame] ? e.eyeFrame : "open", mouth: e.mouth ?? look.mouth, brow: [e.brow[0], e.brow[1]] };
}

/** The blink's frame `t` seconds after it started, or null once it is over (half, closed, half: ~0.15 s). */
export function blinkFrame(t: number): EyeFrame | null {
  let acc = 0;
  for (const [frame, len] of FACE.blink.frames) {
    acc += len;
    if (t < acc) return frame;
  }
  return null;
}

/**
 * The face's clock: blinks at random 2-6 s intervals (FACE.blink), a talking mouth that steps through the larger
 * talk cells and the resting mouth about 9 times a second in a random order that never shows the same cell twice running, emote mouths
 * (Laugh, Cheer, Dance) that alternate their cells, and the clip's expression. One per character.
 */
export class FaceAnimator {
  private t = 0;
  private nextBlink: number;
  private blinkStart = -1;
  private mouthCycle: string | null = null;
  private mouthNow: string | null = null;
  private mouthIndex = 0;
  private mouthUntil = 0;

  constructor(private readonly rand: () => number = Math.random) {
    this.nextBlink = this.interval();
  }

  private interval() {
    const [a, b] = FACE.blink.interval;
    return a + this.rand() * (b - a);
  }

  /** Advance `dt` seconds and return the frame to draw. */
  update(dt: number, look: CharacterLook, clip: string | null, talking: boolean, override?: FaceOverride | null): FacePose {
    this.t += dt;
    const expression = override?.expression ?? (clip ? CLIP_EXPRESSION[clip] : undefined) ?? "neutral";
    const pose = restPose(look, expression);

    if (this.blinkStart < 0 && this.t >= this.nextBlink) this.blinkStart = this.t;
    if (this.blinkStart >= 0) {
      const frame = blinkFrame(this.t - this.blinkStart);
      if (frame === null) {
        this.blinkStart = -1;
        this.nextBlink = this.t + this.interval();
      } else if (canBlink(pose.eyes) && DEPTH[frame] > DEPTH[pose.eyeFrame]) pose.eyeFrame = frame;
    }
    if (override?.eyeFrame && eyeCells(pose.eyes)[override.eyeFrame]) pose.eyeFrame = override.eyeFrame;

    const emote = clip ? FACE.emoteMouth[clip] : undefined;
    const cycle = (override?.talking ?? talking) ? "talk" : emote ? `emote:${clip}` : null;
    if (cycle !== this.mouthCycle) { this.mouthCycle = cycle; this.mouthNow = null; this.mouthUntil = this.t; this.mouthIndex = 0; }
    if (cycle === "talk") {
      if (this.t >= this.mouthUntil) {
        const cells = [pose.mouth, ...FACE.talk.frames].filter(m => m !== this.mouthNow);
        this.mouthNow = cells[Math.floor(this.rand() * cells.length)];
        this.mouthUntil = this.t + (0.7 + 0.6 * this.rand()) / FACE.talk.rate;
      }
      pose.mouth = this.mouthNow!;
    } else if (emote) {
      if (this.t >= this.mouthUntil) {
        this.mouthNow = emote.frames[this.mouthIndex++ % emote.frames.length];
        this.mouthUntil = this.t + 1 / emote.rate;
      }
      pose.mouth = this.mouthNow!;
    }
    if (override?.mouth && (override.mouth in FACE.layers.mouth.items || override.mouth in FACE.layers.talk.items)) pose.mouth = override.mouth;
    return pose;
  }
}

/** A layer slot for the shader. src = atlas rect as UV fractions [x, y, w, h] (top-left origin); dst = where the
 * cell lands on the face canvas [u0, w0, u1, w1] for the canvas-left side; mirror: 0 as placed, 1 also mirrored to
 * the other side, 2 only the mirrored copy; tint = hex multiplied into white art (brows: the hair colour);
 * pose = [pivot u, pivot w, dy, tilt in radians] rotating the cell about its anchor. src null = the slot is off. */
export interface FaceSlot { src: [number, number, number, number] | null; dst: [number, number, number, number]; mirror: 0 | 1 | 2; tint: string | null; pose: [number, number, number, number]; page: 0 | 1 }
/** Extras in draw order: the earlier four as they always drew, then every later accent in catalogue order. */
const EXTRA_ORDER = [...new Set(["blush_band", "blush", "freckles", "mole", ...Object.keys(FACE.layers.extras.items)])];
/** One slot per extra, then brows, the two eyes and the mouth. */
export const FACE_SLOT_COUNT = EXTRA_ORDER.length + 4;
const OFF: FaceSlot = { src: null, dst: [0, 0, 0, 0], mirror: 0, tint: null, pose: [0, 0, 0, 0], page: 0 };

function slot(cell: FaceCell, anchor: [number, number], mirror: 0 | 1 | 2, tint: string | null = null, brow: [number, number] = [0, 0], place?: Placement, paired?: boolean): FaceSlot {
  const [x, y, w, h, ax, ay, page = 0] = cell, [W, H] = page ? FACE.atlas2_size : FACE.atlas_size, k = 1 / FACE.density;
  const u0 = anchor[0] - ax * k, w0 = anchor[1] - ay * k;
  const s: FaceSlot = { src: [x / W, y / H, w / W, h / H], dst: [u0, w0, u0 + w * k, w0 + h * k], mirror, tint, pose: [anchor[0], anchor[1], brow[0], (brow[1] * Math.PI) / 180], page };
  return place && place.some(v => v !== 0) ? placed(s, cell, place, paired) : s;
}

/**
 * A pair drawn as two cells (David's faces): the canvas-right cell, reflected about the centre line, shares the
 * canvas-left cell's pivot (eye_left mirrors eye), so the sliders move both as one mirrored pair (up together, apart
 * symmetrically, rotation mirrored, the same size), clamped by their union so the pair never goes lopsided.
 */
const flip = (t: FaceSlot): FaceSlot => ({ ...t, dst: [1 - t.dst[2], t.dst[1], 1 - t.dst[0], t.dst[3]], pose: [1 - t.pose[0], t.pose[1], t.pose[2], -t.pose[3]] });
function slotPair(right: FaceCell, left: FaceCell, place?: Placement): [FaceSlot, FaceSlot] {
  const A = FACE.anchors, r = slot(right, A.eye, 0), l = slot(left, A.eye_left, 0);
  if (!place || !place.some(v => v !== 0)) return [r, l];
  const [x, y, w, h, ax, ay, page] = left;
  const [rp, lp] = placedTogether([[r, right], [flip(l), [x, y, w, h, w - ax, ay, page]]], place, true);
  return [rp, flip(lp)];
}

/**
 * The face area (canvas units, [u0, w0, u1, w1]) a placed part must stay in: the front of the face between the temples'
 * hairline and the chin (head_shape.face_chart: lat 22 at the temples is w 0.29, lat -50 above the chin about w 0.985,
 * lon ±52 about u 0.07 and 0.93). A part whose default already reaches further keeps that reach (old looks never move).
 */
export const FACE_AREA: readonly [number, number, number, number] = [0.07, 0.3, 0.93, 0.985];
/** The sliders at full travel: up (canvas units), apart (canvas units), rotate (degrees), size (factor at the top). */
export const PLACE_RANGE = { up: 0.07, apart: 0.05, rotate: 25, size: 1.4 } as const;
/** Paired parts (eyes, brows) keep this far from the centre line. */
const CENTRE_GAP = 0.004;

/**
 * Where a slot is drawn on the face canvas: the bounds of its rect turned about its pivot (the shader samples
 * q = pivot + R(tilt)(p - pivot - dy), so the cell shows at p = pivot + dy + R(-tilt)(q - pivot)). For the drawn side;
 * a mirrored copy is the same box mirrored about u = 0.5.
 */
export function slotBounds(s: FaceSlot): [number, number, number, number] {
  const [px, py, dy, tilt] = s.pose, c = Math.cos(tilt), sn = Math.sin(tilt);
  let u0 = Infinity, w0 = Infinity, u1 = -Infinity, w1 = -Infinity;
  for (const [qx, qy] of [[s.dst[0], s.dst[1]], [s.dst[2], s.dst[1]], [s.dst[0], s.dst[3]], [s.dst[2], s.dst[3]]]) {
    const dx = qx - px, dz = qy - py;
    const u = px + dx * c + dz * sn, w = py + dy - dx * sn + dz * c;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w);
  }
  return [u0, w0, u1, w1];
}

/**
 * A slot moved by the creator's sliders: the anchor (and pivot) shifted, the rect scaled about it, the tilt added.
 * Then clamped: shrunk if it can't fit, and slid back inside the face area (paired parts also stay on their own side
 * of the centre line). Only the slot's existing rect and pose change: the shader, its uniforms and draws are as before.
 */
function placed(s: FaceSlot, cell: FaceCell, place: Placement, paired = s.mirror !== 0 || s.dst[2] <= 0.5): FaceSlot {
  return placedTogether([[s, cell]], place, paired)[0];
}

/** placed() for cells that share one pivot, moved and clamped as one (their bounds' union). */
function placedTogether(parts: [FaceSlot, FaceCell][], [up, apart, rotate, size]: Placement, paired: boolean): FaceSlot[] {
  const k = 1 / FACE.density, s = parts[0][0];
  const union = (bs: [number, number, number, number][]): [number, number, number, number] =>
    [Math.min(...bs.map(b => b[0])), Math.min(...bs.map(b => b[1])), Math.max(...bs.map(b => b[2])), Math.max(...bs.map(b => b[3]))];
  const before = union(parts.map(([p]) => slotBounds(p)));
  const area = [Math.min(FACE_AREA[0], before[0]), Math.min(FACE_AREA[1], before[1]), Math.max(FACE_AREA[2], before[2]), Math.max(FACE_AREA[3], before[3])];
  if (paired) area[2] = Math.max(Math.min(area[2], 0.5 - CENTRE_GAP), before[2]);
  const turn = ((rotate / PLACE_STEPS) * PLACE_RANGE.rotate * Math.PI) / 180;
  let scale = PLACE_RANGE.size ** (size / PLACE_STEPS);
  let u = s.pose[0] - (paired ? (apart / PLACE_STEPS) * PLACE_RANGE.apart : 0), v = s.pose[1] - (up / PLACE_STEPS) * PLACE_RANGE.up;
  const at = (): FaceSlot[] => parts.map(([p, [, , w, h, ax, ay]]) => {
    const kk = k * scale, u0 = u - ax * kk, w0 = v - ay * kk;
    return { ...p, dst: [u0, w0, u0 + w * kk, w0 + h * kk], pose: [u, v, p.pose[2], p.pose[3] + turn] };
  });
  let out = at(), b = union(out.map(slotBounds));
  const fit = Math.min(1, (area[2] - area[0]) / (b[2] - b[0]), (area[3] - area[1]) / (b[3] - b[1]));
  if (fit < 1) { scale *= fit; out = at(); b = union(out.map(slotBounds)); }
  u += Math.max(0, area[0] - b[0]) - Math.max(0, b[2] - area[2]);
  v += Math.max(0, area[1] - b[1]) - Math.max(0, b[3] - area[3]);
  return at();
}

/**
 * The two eye slots. Most eye styles are one eye, mirrored for the other side. David's asymmetric pairs carry their
 * canvas-right eye as its own `left` cell (at the eye_left anchor, moved as the mirror image of the other); a pair
 * drawn as one cell (left: null, marks across the centre line) sits at eye_pair on the centre line, and the second
 * slot is off (its spacing slider has nothing to spread).
 */
function eyeSlots(eye: ReturnType<typeof eyeCells>, cell: FaceCell, place?: Placement): [FaceSlot, FaceSlot] {
  const A = FACE.anchors;
  if (eye.left === null) return [slot(cell, A.eye_pair, 0, null, undefined, place, false), OFF];
  if (eye.left) return slotPair(cell, eye.left, place);
  return [slot(cell, A.eye, 0, null, undefined, place), slot(cell, A.eye, 2, null, undefined, place)];
}

/** The slots (each extra, brows, right eye, left eye, mouth) for a look showing `pose`. */
export function faceSlots(look: CharacterLook, pose: FacePose): FaceSlot[] {
  const { extras, brows, mouth } = FACE.layers, A = FACE.anchors, P = look.place;
  const extra = (id: string) => {
    const it = extras.items[id];
    return look.extras.includes(id) && it ? slot(it.cell, A[it.anchor], it.mirror ? 1 : 0) : OFF;
  };
  const eye = eyeCells(pose.eyes), eyeCell = eye[pose.eyeFrame] ?? eye.open;
  const browCell = brows.items[look.brows] ?? brows.items[brows.default];
  return [
    ...EXTRA_ORDER.map(extra),
    browCell[2] ? slot(browCell, A.brow, 1, PALETTE.hair[look.hair], pose.brow, P?.brows) : OFF,   // an empty cell: no brows
    ...eyeSlots(eye, eyeCell, P?.eyes),
    slot(mouth.items[pose.mouth] ?? FACE.layers.talk.items[pose.mouth] ?? mouth.items[mouth.default], A.mouth, 0, null, undefined, P?.mouth),
  ];
}

/** A key for a pose (skip uniform uploads when nothing changed). */
export const poseKey = (p: FacePose) => `${p.eyes}|${p.eyeFrame}|${p.mouth}|${p.brow[0]}|${p.brow[1]}`;
