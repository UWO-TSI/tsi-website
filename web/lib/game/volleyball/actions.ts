/**
 * What each control does in each stance (specs/minigames/beach-volleyball.md §3): the one table the match's input
 * (match.ts humanStep), the action bar (VolleyHud) and the tests read, so what the bar shows is what a key does.
 * Pure.
 */
import { SLIDE_WINDOW, serverOf, type Match } from "./match";

export type Control = "left" | "e" | "right" | "ctrl" | "jump" | "dash";
export type Action = "charge" | "serve" | "spin" | "bump" | "set" | "jumpset" | "spike" | "block" | "call" | "dive" | "slide" | "jump" | "dash";
/** Your stance: serving (before the toss), the toss in the air, or in the rally on the sand or in the air; idle between points. */
export type Stance = "serve" | "toss" | "ground" | "air" | "idle";

export const ACTIONS: Record<Stance, Partial<Record<Control, Action>>> = {
  serve: { left: "charge", right: "spin" },
  toss: { left: "serve", jump: "jump" },
  ground: { left: "bump", e: "set", right: "call", ctrl: "dive", jump: "jump", dash: "dash" },
  air: { left: "spike", e: "jumpset", right: "block", dash: "dash" },
  idle: {},
};

/** The order the bar shows a stance's actions in (the main hit first). */
export const BAR: Record<Stance, Action[]> = {
  serve: ["charge", "spin"],
  toss: ["serve", "jump"],
  ground: ["bump", "set", "call", "dive", "jump"],
  air: ["spike", "jumpset", "block"],
  idle: [],
};

/** The control for an action in a stance (the bar's keycap). */
export function controlOf(stance: Stance, action: Action): Control | null {
  const row = ACTIONS[stance];
  for (const c of Object.keys(row) as Control[]) if (row[c] === action) return c;
  return stance === "ground" && action === "slide" ? "ctrl" : null;
}

export function stanceOf(m: Match, i: number): Stance {
  const p = m.players[i], sv = serverOf(m) === i;
  if (m.phase === "serve") return sv ? "serve" : "idle";
  if (m.phase === "toss") return sv ? "toss" : "idle";
  if (m.phase !== "rally") return "idle";
  return p.s.mode === "air" ? "air" : "ground";
}

/** What a press of `c` does for player `i` now: Ctrl's dive is the slide dive just after a dash (or during one). */
export function actionFor(m: Match, i: number, c: Control): Action | null {
  const a = ACTIONS[stanceOf(m, i)][c] ?? null, p = m.players[i];
  return a === "dive" && (p.s.dashT > 0 || p.sinceDash < SLIDE_WINDOW) ? "slide" : a;
}
