/**
 * Drawn incantations (rows C2, 52, 53, C3). Runes live in a unit box (0..1);
 * the client maps pointer positions into that box and sends strokes of
 * {x, y, t} points. The score is a gameplay rating, not an objective shape
 * likeness (plan §Drawn incantations):
 *
 *   accuracy = 100 × (0.45·coverage + 0.35·closeness + 0.20·order) × ink penalty
 *
 *   coverage  share of the guide that some trace passes near (tolerance)
 *   closeness how close the ink stays to the guide on average
 *   order     each guide stroke drawn as its own stroke, in order and direction
 *   ink       anti-scribble: too much ink, or ink far from the guide, is penalised
 *
 * Traces are resampled to a fixed spacing first, so mouse vs trackpad sampling
 * rates don't change the score. Past the spell's time limit the cast fails.
 * <50 fizzles; 50–94 scales potency 0.5→1.0; 95+ is enhanced (1.5 for damage).
 */
export interface Pt {
  x: number;
  y: number;
}
export interface TracePt extends Pt {
  t: number; // ms since casting started
}
export interface Rune {
  key: string;
  name: string;
  difficulty: "easy" | "hard";
  strokes: Pt[][];
  time_limit_ms: number;
}

export const TOLERANCE = 0.08;
const SPACING = 0.01;

export const RUNES: Rune[] = [
  {
    key: "spark",
    name: "Spark",
    difficulty: "easy",
    time_limit_ms: 4000,
    strokes: [[{ x: 0.25, y: 0.1 }, { x: 0.6, y: 0.48 }, { x: 0.38, y: 0.55 }, { x: 0.78, y: 0.92 }]],
  },
  {
    key: "binding",
    name: "Sigil of Binding",
    difficulty: "hard",
    time_limit_ms: 7000,
    strokes: [
      [{ x: 0.5, y: 0.08 }, { x: 0.92, y: 0.86 }, { x: 0.08, y: 0.86 }, { x: 0.5, y: 0.08 }],
      [{ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.76 }],
      [{ x: 0.3, y: 0.6 }, { x: 0.7, y: 0.6 }],
    ],
  },
];

const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const pathLength = (p: Pt[]) => p.slice(1).reduce((n, q, i) => n + d(p[i], q), 0);

/** Evenly spaced points along a polyline. */
export function resample(p: Pt[], spacing = SPACING): Pt[] {
  if (p.length < 2) return p.slice();
  const out: Pt[] = [p[0]];
  let carry = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const seg = d(a, b);
    let pos = spacing - carry;
    while (pos <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * pos) / seg, y: a.y + ((b.y - a.y) * pos) / seg });
      pos += spacing;
    }
    carry = seg - (pos - spacing);
  }
  if (d(out[out.length - 1], p[p.length - 1]) > spacing / 2) out.push(p[p.length - 1]);
  return out;
}

/** Keep points at least `gap` apart: hand jitter smaller than the gap doesn't add ink. */
export function decimate(p: Pt[], gap = 0.03): Pt[] {
  if (!p.length) return [];
  const out = [p[0]];
  for (const q of p) if (d(q, out[out.length - 1]) >= gap) out.push(q);
  if (out[out.length - 1] !== p[p.length - 1]) out.push(p[p.length - 1]);
  return out;
}

function nearest(p: Pt, pts: Pt[]): number {
  let m = Infinity;
  for (const q of pts) {
    const v = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (v < m) m = v;
  }
  return Math.sqrt(m);
}

export type CastOutcome = "fizzle" | "cast" | "enhanced" | "timeout";
export interface Score {
  accuracy: number; // 0..100
  outcome: CastOutcome;
  potency: number; // 0, 0.5..1, or 1.5
  parts: { coverage: number; closeness: number; order: number; ink_ratio: number; off_path: number };
}

export function potencyFor(accuracy: number): { outcome: Exclude<CastOutcome, "timeout">; potency: number } {
  if (accuracy < 50) return { outcome: "fizzle", potency: 0 };
  if (accuracy >= 95) return { outcome: "enhanced", potency: 1.5 };
  return { outcome: "cast", potency: Math.round((0.5 + (0.5 * (accuracy - 50)) / 45) * 100) / 100 };
}

export function scoreTrace(rune: Rune, trace: TracePt[][], tol = TOLERANCE): Score {
  const strokes = trace.filter((s) => s.length > 0);
  const zero = { accuracy: 0, potency: 0, parts: { coverage: 0, closeness: 0, order: 0, ink_ratio: 0, off_path: 1 } };
  if (!strokes.length) return { ...zero, outcome: "fizzle" };
  const times = strokes.flat().map((p) => p.t);
  if (Math.max(...times) - Math.min(...times) > rune.time_limit_ms) return { ...zero, outcome: "timeout" };

  const guide = rune.strokes.map((s) => resample(s));
  const guideAll = guide.flat();
  const ink = strokes.map((s) => resample(s));
  const inkAll = ink.flat();

  // Coverage: guide samples with ink nearby.
  const coverage = guideAll.filter((g) => nearest(g, inkAll) <= tol).length / guideAll.length;
  // Closeness: mean ink distance from the guide, 0 at 2×tolerance.
  const meanDev = inkAll.reduce((n, p) => n + nearest(p, guideAll), 0) / inkAll.length;
  const closeness = Math.max(0, 1 - meanDev / (2 * tol));
  // Order + direction: trace stroke i starts near guide stroke i's start and ends near its end.
  let ordered = 0;
  rune.strokes.forEach((gs, i) => {
    const s = strokes[i];
    if (!s) return;
    const startOk = d(s[0], gs[0]) <= 2 * tol;
    const endOk = d(s[s.length - 1], gs[gs.length - 1]) <= 2 * tol;
    const bodyOk = resample(s).filter((p) => nearest(p, guide[i]) <= tol).length / Math.max(1, resample(s).length) >= 0.7;
    if (startOk && endOk && bodyOk) ordered += 1;
  });
  const extraStrokes = Math.max(0, strokes.length - rune.strokes.length);
  const order = Math.max(0, ordered / rune.strokes.length - 0.25 * extraStrokes);
  // Anti-scribble: ink beyond 1.6× the guide's length, and ink far off the guide.
  const inkRatio = strokes.reduce((n, s) => n + pathLength(decimate(s)), 0) / rune.strokes.reduce((n, s) => n + pathLength(s), 0);
  const offPath = inkAll.filter((p) => nearest(p, guideAll) > 2 * tol).length / inkAll.length;
  const penalty = Math.max(0, 1 - Math.max(0, inkRatio - 1.6) * 1.2) * (1 - offPath);

  const accuracy = Math.round(100 * (0.45 * coverage + 0.35 * closeness + 0.2 * order) * penalty * 10) / 10;
  const p = potencyFor(accuracy);
  return { accuracy, ...p, parts: { coverage: round(coverage), closeness: round(closeness), order: round(order), ink_ratio: round(inkRatio), off_path: round(offPath) } };
}
const round = (n: number) => Math.round(n * 1000) / 1000;
