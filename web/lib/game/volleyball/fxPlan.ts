/**
 * The match's effects as data (David's approved plan, 2026-10-30): the particle recipes, the colours, and how each
 * contact looks in each timing grade. VolleyFx.tsx draws from this; tests read it. Pure (no three.js).
 *
 * The grades read at a glance: perfect is gold and the biggest; good is clean white; early and late are softer,
 * desaturated puffs (early cool, late warm) with a small tag, so a mistimed touch never looks like a good one.
 */
import { FACE, type Recipe } from "@/lib/game/fx/particles";
import type { ContactKind, Timing } from "./match";

/** sRGB hex colours (3D effects only; the HUD's stamps use the theme's tokens). */
export const FX_COLOR = {
  gold: 0xffc93c, white: 0xffffff, early: 0xa9bccb, late: 0xc8b49c, sand: 0xe9d3a0, sandDark: 0xc9a86a, crater: 0xb6955c,
  home: 0xef7a5a, away: 0x4bb3c8, out: 0xe8553c, heatOrange: 0xff8a3d, heatPink: 0xff4f9a, spark: 0xfff1b8,
} as const;
export const TEAM_COLOR = [FX_COLOR.home, FX_COLOR.away] as const;

export interface GradeLook {
  /** The tint of the contact's flash, rings and sparkles. */
  tint: number;
  /** Size and count of everything the contact throws. */
  scale: number;
  /** A burst of additive light at the core (perfect only: light washes out on a sunny beach, so the rest is painted). */
  glow: boolean;
  /** Sparkles and glints round the contact. */
  sparkles: number;
  /** Rings: how many expand from the contact, and how far (u). */
  rings: number; ringSize: number;
}

export const GRADE_LOOK: Record<Timing, GradeLook> = {
  perfect: { tint: FX_COLOR.gold, scale: 1.45, glow: true, sparkles: 1.5, rings: 2, ringSize: 1.25 },
  good: { tint: FX_COLOR.white, scale: 1, glow: false, sparkles: 0.8, rings: 1, ringSize: 1 },
  early: { tint: FX_COLOR.early, scale: 0.7, glow: false, sparkles: 0, rings: 1, ringSize: 0.6 },
  late: { tint: FX_COLOR.late, scale: 0.7, glow: false, sparkles: 0, rings: 1, ringSize: 0.6 },
};

/** The camera and time beat a contact asks for (shake 0..1, zoom punch in FOV degrees, hit-stop and slow-mo in s). */
export function contactBeat(how: ContactKind, timing: Timing, speed: number): { shake: number; punch: number; stop: number; slow: number } {
  const perfect = timing === "perfect", soft = timing === "early" || timing === "late";
  const sp = Math.min(1, speed / 24);
  if (how === "spike") return { shake: soft ? 0.25 : 0.55 + 0.4 * sp, punch: soft ? 0 : perfect ? 6 : 3.5, stop: soft ? 0 : perfect ? 0.08 : 0.05, slow: perfect ? 0.45 : 0 };
  if (how === "serve") return { shake: soft ? 0.12 : 0.3 + 0.3 * sp, punch: soft ? 0 : perfect ? 4 : 2, stop: perfect ? 0.05 : 0, slow: perfect ? 0.35 : 0 };
  if (how === "block") return { shake: 0.5, punch: perfect ? 3 : 1.5, stop: 0.05, slow: 0 };
  if (how === "dig") return { shake: 0.25, punch: 1.5, stop: 0, slow: 0 };
  return { shake: soft ? 0 : 0.1, punch: 0, stop: 0, slow: 0 };
}

/** The ball's heat through a rally (touches): 0 cold, 1 at full heat; it catches fire from `fireAt`. */
export const HEAT = { full: 9, fireAt: 6 } as const;
export const heatOf = (touches: number) => Math.max(0, Math.min(1, touches / HEAT.full));

/** The trail's colour by heat: white, then orange, then hot pink (sRGB channels 0..1). */
export function heatColor(h: number, out: { r: number; g: number; b: number }) {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ch = (c: number, s: number) => ((c >> s) & 255) / 255;
  const [a, b, t] = h < 0.5 ? [FX_COLOR.white, FX_COLOR.heatOrange, h * 2] : [FX_COLOR.heatOrange, FX_COLOR.heatPink, (h - 0.5) * 2];
  out.r = lerp(ch(a, 16), ch(b, 16), t); out.g = lerp(ch(a, 8), ch(b, 8), t); out.b = lerp(ch(a, 0), ch(b, 0), t);
  return out;
}

/** The sand's explosion on a point, scaled by the ball's speed and the rally's heat (a long rally ends bigger). */
export const landScale = (speed: number, heat: number) => Math.min(2.2, 0.8 + speed / 22 + heatOf(heat) * 0.7);

// ── Recipes (world units; lib/game/fx/particles.ts) ─────────────────────────
const B = FACE.billboard;
/** A sand explosion: grains thrown up and out. */
export const SAND_BLAST: Recipe = { sprite: "sandBurst", count: [7, 9], life: [0.55, 0.8], size: [0.55, 0.8], grow: 1.3, speed: [1.6, 3.4], spread: Math.PI, up: [2.2, 4.2], gravity: 9, drag: 1.4, wind: 0.2, spin: 3, alpha: 1, face: B, rise: [0.05, 0.15] };
/** Its dust: a low ring and a rising plume. */
export const DUST_RING: Recipe = { sprite: "dustLow", count: [10, 12], life: [0.6, 0.85], size: [0.8, 1.05], grow: 1.6, speed: [2.4, 3.6], spread: 0, up: [0, 0.1], gravity: 0, drag: 4.5, wind: 0.5, lift: 0.05, alpha: 0.9, face: FACE.standing, jitter: 0.15 };
export const DUST_PLUME: Recipe = { sprite: "dust", count: [4, 5], life: [0.8, 1.1], size: [0.9, 1.2], grow: 1.7, speed: [0.3, 0.8], spread: Math.PI, up: [0.7, 1.2], gravity: 0, drag: 3, wind: 0.6, lift: 0.45, alpha: 0.85, face: B, rise: [0.15, 0.3] };
/** A small sand puff at the feet (a bump, a takeoff). */
export const SAND_PUFF: Recipe = { sprite: "sand", count: [3, 4], life: [0.4, 0.55], size: [0.5, 0.65], grow: 1.3, speed: [0.6, 1.3], spread: Math.PI, up: [0.6, 1.1], gravity: 4, drag: 3, wind: 0.3, alpha: 0.95, face: B, rise: [0.05, 0.12] };
/** A soft matte puff at the hands: an early or a late touch. */
export const SOFT_PUFF: Recipe = { sprite: "dust", count: [5, 6], life: [0.45, 0.6], size: [0.6, 0.8], grow: 1.8, speed: [0.5, 1.1], spread: Math.PI, up: [-0.2, 0.4], gravity: 0, drag: 4, wind: 0.4, lift: 0.1, alpha: 0.75, face: B };
/** Sparkles round a clean touch (additive). */
export const SPARKLES: Recipe = { sprite: "sparkle", count: [6, 8], life: [0.4, 0.6], size: [0.26, 0.36], grow: 0.6, speed: [1.2, 2.6], spread: Math.PI, up: [-0.8, 1.6], gravity: 1.5, drag: 2.5, wind: 0, alpha: 1, face: B };
/** A glint: the star at a hand (the spike's apex, a perfect touch). */
export const GLINT: Recipe = { sprite: "glint", count: [1, 1], life: [0.32, 0.38], size: [0.7, 0.8], grow: 1.3, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: B };
/** A burst of light (a hit flash's core, a max-power toss, fireworks). */
export const GLOW_BURST: Recipe = { sprite: "glow", count: [1, 1], life: [0.18, 0.24], size: [0.9, 1.1], grow: 1.9, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: B };
/** Speed lines along a spike or a jump. */
export const SPEED_LINES: Recipe = { sprite: "streak", count: [6, 7], life: [0.2, 0.3], size: [1.1, 1.6], grow: 1.2, aspect: 0.18, speed: [5, 9], spread: 0.35, up: [-0.6, 0.6], gravity: 0, drag: 2, wind: 0, alpha: 0.85, face: FACE.streak, jitter: 0.25 };
/** The ball on fire: flames shed behind it (additive). */
export const FLAME: Recipe = { sprite: "glow", count: [1, 2], life: [0.22, 0.34], size: [0.32, 0.46], grow: 0.4, speed: [0.2, 0.6], spread: Math.PI, up: [0.6, 1.2], gravity: -1, drag: 2, wind: 0.2, alpha: 0.9, face: B, jitter: 0.08 };
/** The serve's charge: motes of light drawn in to the ball. */
export const CHARGE_MOTE: Recipe = { sprite: "glow", count: [1, 1], life: [0.28, 0.34], size: [0.14, 0.2], grow: 0.5, speed: [1.8, 2.4], spread: 0.15, up: [-0.2, 0.2], gravity: 0, drag: 0, wind: 0, alpha: 0.9, face: B };
/** A dive's spray arc and its dust cloud. */
export const DIVE_SPRAY: Recipe = { sprite: "sandBurst", count: [6, 8], life: [0.5, 0.7], size: [0.45, 0.65], grow: 1.2, speed: [2.2, 3.8], spread: 0.7, up: [1.6, 2.8], gravity: 8, drag: 1.5, wind: 0.2, spin: 3, alpha: 1, face: B, rise: [0.05, 0.12] };
export const DIVE_CLOUD: Recipe = { sprite: "dust", count: [5, 7], life: [0.7, 1], size: [0.7, 0.95], grow: 1.7, speed: [0.6, 1.4], spread: 1.2, up: [0.2, 0.5], gravity: 0, drag: 3, wind: 0.5, lift: 0.25, alpha: 0.85, face: B, rise: [0.1, 0.25] };
/** A skid mark the slide dive leaves (on the ground, fading). */
export const SKID: Recipe = { sprite: "scuff", count: [1, 1], life: [2.4, 2.8], size: [0.55, 0.65], grow: 1, aspect: 1.6, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.7, face: FACE.ground, fadeIn: 50 };
/** Confetti: petals in the team's colour, tumbling down. */
export const CONFETTI: Recipe = { sprite: "petal", count: [14, 18], life: [1.4, 2], size: [0.2, 0.28], grow: 1, speed: [1.4, 3.2], spread: Math.PI, up: [3.5, 5.5], gravity: 3.2, drag: 1.4, wind: 0.6, spin: 6, fps: 14, alpha: 1, face: B, rise: [0.4, 0.8] };
/** A firework's shell bursting (additive sparks falling). */
export const FIREWORK: Recipe = { sprite: "sparkle", count: [22, 28], life: [1.1, 1.5], size: [0.5, 0.7], grow: 0.4, speed: [5, 7], spread: Math.PI, up: [-5, 6], gravity: 2.4, drag: 1.2, wind: 0.2, alpha: 1, face: B };
/** A whiff: a little swish of air. */
export const SWISH: Recipe = { sprite: "swirl", count: [1, 1], life: [0.26, 0.3], size: [0.6, 0.7], grow: 1.3, speed: [0.4, 0.4], spread: 0, up: [0, 0], gravity: 0, drag: 3, wind: 0, alpha: 0.6, face: B };

/** What a contact throws, by kind: the pieces VolleyFx plays (and in what colour). */
export interface ContactPlan {
  look: GradeLook;
  /** A camera-facing flash ring at the contact, and a ground pulse ring at the feet. */
  flash: boolean; pulse: boolean;
  /** Sand at the feet, sparkles, a glint, speed lines, a shield ripple at the net, a dive's spray. */
  sand: boolean; sparkles: boolean; glint: boolean; lines: boolean; shield: boolean; spray: boolean;
  /** The stamp over the action for this contact, if any (VolleyStamps). */
  stamp: "Perfect!" | "Good" | "Early" | "Late" | "BLOCK!" | "SAVED!" | null;
}

/** The plan for one contact: its kind's pieces in its grade's look. `mine`: your touch (the timing tags are yours only). */
export function contactPlan(how: ContactKind, timing: Timing, mine: boolean, myTeam: boolean): ContactPlan {
  const look = GRADE_LOOK[timing], clean = timing === "perfect" || timing === "good";
  const tag = mine ? (timing === "perfect" ? "Perfect!" : timing === "good" ? "Good" : timing === "early" ? "Early" : "Late") : null;
  return {
    look,
    flash: clean || how === "spike" || how === "serve" || how === "block",
    pulse: how === "bump" || how === "dig",
    sand: how === "bump" || how === "dig",
    sparkles: look.sparkles > 0 && how !== "block",
    glint: timing === "perfect" || how === "spike",
    lines: how === "spike" && clean,
    shield: how === "block",
    spray: how === "dig",
    stamp: how === "block" ? "BLOCK!" : how === "dig" && myTeam ? "SAVED!" : tag,
  };
}
