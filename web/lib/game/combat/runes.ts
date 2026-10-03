/**
 * Incantations (rows C2, 52, 53): the systems agent's runes (`spark` easy,
 * `binding` hard; canonical per the coordinator) and its scorer via
 * islandAdapter.islandScore. Island adds the effect wording and the guide
 * arrows. Points are [x, y] in a unit box, y down; traces carry ms times.
 */
import { RUNES as SYSTEM_RUNES, SHAPES } from "@/lib/combat/incantation";
import { islandScore } from "@/lib/combat/islandAdapter";
import type { IncantationScore } from "./contract";

export type Pt = [number, number];
export type TracePt = [number, number, number];
/** Today's runes (spark, binding) and the classes v2 shapes (cross, circle, line, triangle, chevron, wings). */
export interface Rune { id: string; name: string; difficulty: "easy" | "hard"; strokes: Pt[][]; timeLimitMs: number }

export const RUNES: Rune[] = [...SYSTEM_RUNES, ...SHAPES].map(r => ({
  id: r.key, name: r.name, difficulty: r.difficulty, timeLimitMs: r.time_limit_ms,
  strokes: r.strokes.map(s => s.map(p => [p.x, p.y] as Pt)),
}));
export const runeById = (id: string) => RUNES.find(r => r.id === id)!;

/** Classes v2 shapes drawn the way the spell goes: the Holy Beam's line, Light Step's chevron (both authored pointing right). */
export const DIRECTIONAL = new Set(["line", "chevron"]);
/** A rune turned by `angle` radians round the box's centre (screen angle: 0 right, -π/2 up). */
export function turnRune(rune: Rune, angle: number): Rune {
  if (!angle) return rune;
  const c = Math.cos(angle), s = Math.sin(angle);
  return { ...rune, strokes: rune.strokes.map(st => st.map(([x, y]) => [0.5 + (x - 0.5) * c - (y - 0.5) * s, 0.5 + (x - 0.5) * s + (y - 0.5) * c] as Pt)) };
}
/** Where a world direction points on screen for a camera turned `yaw` (orbitCamera: it looks along (sin yaw, cos yaw)): 0 right, -π/2 up. */
export function screenAngle(dx: number, dz: number, yaw: number): number {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), up = dx * fx + dz * fz, right = -dx * fz + dz * fx;
  return Math.atan2(-up, right);
}

/** Start point and heading of each stroke, for the guide arrow. */
export function strokeGuides(rune: Rune): { start: Pt; angle: number }[] {
  return rune.strokes.map(s => ({ start: s[0], angle: Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]) }));
}

/** Systems scorer; <50 fizzles, 95+ enhanced, past the time limit fails. */
export function scoreTrace(rune: Rune, traces: (Pt | TracePt)[][]): IncantationScore {
  return islandScore(rune.strokes, traces, rune.timeLimitMs);
}
