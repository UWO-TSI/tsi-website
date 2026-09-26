/**
 * Oracle scoring and family mapping (rows 19, 205, 207).
 *
 * Answers are -2..+2 (strongly disagree .. strongly agree). An item keyed to
 * the second pole of its dichotomy is reverse-scored. A dichotomy's score is
 * the sum of its items: >0 → first letter (E, S, T, J), <0 → second (I, N, F, P).
 * An exact 0 is settled by tie-breaker questions, served only for tied
 * dichotomies; if those also tie (or are skipped), the stronger of the
 * dichotomy's most confident answers decides, and failing that the second
 * letter (I, N, F, P) is used and the result is marked low-clarity.
 */
import { fnv1a } from "@/lib/game/weatherSystem";
import { STATEMENTS, TIE_BREAKERS, type Dichotomy, type Pole } from "./items";

export const DICHOTOMIES: Dichotomy[] = ["EI", "SN", "TF", "JP"];
export const FIRST: Record<Dichotomy, Pole> = { EI: "E", SN: "S", TF: "T", JP: "J" };
export const SECOND: Record<Dichotomy, Pole> = { EI: "I", SN: "N", TF: "F", JP: "P" };

export type Family = "Arcane" | "Ranger" | "Vanguard" | "Warden";
export const FAMILY_COLOR: Record<Family, string> = { Arcane: "purple", Ranger: "blue", Vanguard: "yellow", Warden: "green" };

/** Row 19: NT → Arcane, SJ → Ranger, SP → Vanguard, NF → Warden. */
export function familyFor(type: string): Family {
  const [, sn, tf, jp] = type.toUpperCase().split("");
  if (sn === "N") return tf === "T" ? "Arcane" : "Warden";
  return jp === "J" ? "Ranger" : "Vanguard";
}

export type Answers = Record<string, number>; // statement id → -2..2
export type TieAnswers = Record<string, Pole>; // tie-breaker id → chosen pole

const byId = new Map(STATEMENTS.map((x) => [x.id, x]));

export function validAnswer(id: string, value: unknown): boolean {
  return byId.has(id) && typeof value === "number" && Number.isInteger(value) && value >= -2 && value <= 2;
}

export interface DichotomyScore {
  dichotomy: Dichotomy;
  score: number; // positive → FIRST pole
  max: number;
  letter: Pole;
  clarity: number; // 0..100
  decided_by: "items" | "tie_breaker" | "strongest_answer" | "default";
}

export function rawScores(answers: Answers): Record<Dichotomy, number> {
  const out: Record<Dichotomy, number> = { EI: 0, SN: 0, TF: 0, JP: 0 };
  for (const [id, v] of Object.entries(answers)) {
    const it = byId.get(id);
    if (!it || !validAnswer(id, v)) continue;
    out[it.dichotomy] += it.pole === FIRST[it.dichotomy] ? v : -v;
  }
  return out;
}

export function tiedDichotomies(answers: Answers): Dichotomy[] {
  const r = rawScores(answers);
  return DICHOTOMIES.filter((d) => r[d] === 0);
}

export function tieBreakersFor(dichotomies: Dichotomy[]) {
  return TIE_BREAKERS.filter((t) => dichotomies.includes(t.dichotomy));
}

export interface OracleResult {
  type: string;
  family: Family;
  dichotomies: DichotomyScore[];
  low_clarity: boolean;
}

export function missing(answers: Answers): string[] {
  return STATEMENTS.filter((x) => !validAnswer(x.id, answers[x.id])).map((x) => x.id);
}

export function score(answers: Answers, ties: TieAnswers = {}): OracleResult {
  const raw = rawScores(answers);
  const dichotomies = DICHOTOMIES.map((d): DichotomyScore => {
    const items = STATEMENTS.filter((x) => x.dichotomy === d);
    const max = items.length * 2;
    let s = raw[d];
    let decided: DichotomyScore["decided_by"] = "items";
    if (s === 0) {
      const picks = TIE_BREAKERS.filter((t) => t.dichotomy === d && ties[t.id]).map((t) => ties[t.id]);
      const tb = picks.reduce((n, p) => n + (p === FIRST[d] ? 1 : p === SECOND[d] ? -1 : 0), 0);
      if (tb !== 0) {
        s = Math.sign(tb) * 0.5;
        decided = "tie_breaker";
      } else {
        // The single most confident answer in this dichotomy (earliest in bank order on equal strength).
        const strongest = items
          .map((x) => ({ x, v: answers[x.id] ?? 0 }))
          .filter((a) => a.v !== 0)
          .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
        if (strongest) {
          s = (strongest.x.pole === FIRST[d] ? strongest.v : -strongest.v) > 0 ? 0.5 : -0.5;
          decided = "strongest_answer";
        } else {
          s = -0.5;
          decided = "default";
        }
      }
    }
    return { dichotomy: d, score: raw[d], max, letter: s > 0 ? FIRST[d] : SECOND[d], clarity: Math.round((Math.abs(raw[d]) / max) * 100), decided_by: decided };
  });
  const type = dichotomies.map((x) => x.letter).join("");
  return { type, family: familyFor(type), dichotomies, low_clarity: dichotomies.some((x) => x.decided_by === "default") };
}

/** Deterministic, interleaved item order per attempt (dichotomies alternate so the keeper's beats land evenly). */
export function itemOrder(seed: string): string[] {
  let h = fnv1a(seed);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h >>> 0) / 4294967296;
  };
  const groups = DICHOTOMIES.map((d) => {
    const g = STATEMENTS.filter((x) => x.dichotomy === d).map((x) => x.id);
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    return g;
  });
  const out: string[] = [];
  for (let i = 0; i < groups[0].length; i++) {
    const round = DICHOTOMIES.map((_, k) => groups[k][i]);
    for (let k = round.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [round[k], round[j]] = [round[j], round[k]];
    }
    out.push(...round);
  }
  return out;
}

/** The keeper reacts every ~10 answers (island UI hook). */
export const KEEPER_BEAT_EVERY = 10;
export function keeperBeat(answered: number, total: number): number | null {
  if (answered === total) return null;
  return answered > 0 && answered % KEEPER_BEAT_EVERY === 0 ? answered / KEEPER_BEAT_EVERY : null;
}
