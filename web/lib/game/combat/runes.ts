/**
 * Incantations (rows C2, 52, 53): the systems agent's runes (`spark` easy,
 * `binding` hard; canonical per the coordinator) and its scorer via
 * islandAdapter.islandScore. Island adds the effect wording and the guide
 * arrows. Points are [x, y] in a unit box, y down; traces carry ms times.
 */
import { RUNES as SYSTEM_RUNES } from "@/lib/combat/incantation";
import { islandScore } from "@/lib/combat/islandAdapter";
import type { IncantationScore } from "./contract";

export type Pt = [number, number];
export type TracePt = [number, number, number];
export interface Rune { id: "spark" | "binding"; name: string; difficulty: "easy" | "hard"; effect: string; strokes: Pt[][]; timeLimitMs: number; energy: number }

const EFFECT: Record<string, string> = { spark: "A burst of lightning where you aim.", binding: "A sigil that damages and roots everything around you." };
/** Placeholder energy costs until the kits give standalone runes a number (energy ruling: 100 max, 12/s regen). */
const ENERGY: Record<string, number> = { spark: 20, binding: 45 };
export const RUNES: Rune[] = SYSTEM_RUNES.map(r => ({
  id: r.key as Rune["id"], name: r.name, difficulty: r.difficulty, effect: EFFECT[r.key] ?? "", timeLimitMs: r.time_limit_ms, energy: ENERGY[r.key] ?? 30,
  strokes: r.strokes.map(s => s.map(p => [p.x, p.y] as Pt)),
}));
export const runeById = (id: string) => RUNES.find(r => r.id === id)!;

/** Start point and heading of each stroke, for the guide arrow. */
export function strokeGuides(rune: Rune): { start: Pt; angle: number }[] {
  return rune.strokes.map(s => ({ start: s[0], angle: Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]) }));
}

/** Systems scorer; <50 fizzles, 95+ enhanced, past the time limit fails. */
export function scoreTrace(rune: Rune, traces: (Pt | TracePt)[][]): IncantationScore {
  return islandScore(rune.strokes, traces, rune.timeLimitMs);
}
