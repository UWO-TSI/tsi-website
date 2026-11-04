/**
 * What each control does in each stance (specs/minigames/beach-volleyball.md §3): the one table the match's input
 * (match.ts humanStep), the action bar (VolleyHud) and the tests read, so what the bar shows is what a key does.
 * Pure.
 */
import { serverOf, type Match } from "./match";

/** `dash` is the movement's dash key (Q by default): in the court it dives. */
export type Control = "left" | "e" | "right" | "jump" | "dash";
export type Action = "charge" | "serve" | "spin" | "bump" | "set" | "jumpset" | "spike" | "block" | "call" | "dive" | "jump";
/** Your stance: serving (before the toss), the toss in the air, or in the rally on the sand or in the air; idle between points. */
export type Stance = "serve" | "toss" | "ground" | "air" | "idle";

export const ACTIONS: Record<Stance, Partial<Record<Control, Action>>> = {
  serve: { left: "charge", right: "spin" },
  toss: { left: "serve", jump: "jump" },
  ground: { left: "bump", e: "set", right: "call", dash: "dive", jump: "jump" },
  air: { left: "spike", e: "jumpset", right: "block" },
  idle: {},
};

/**
 * What the bar shows in each stance, the main hit first (David, round 3: "the bar should old show bump set dive, no
 * jump or right click for callout. and jumping should switch the set of ui to jumping actions"). Jump and the call
 * still work; they just aren't on the bar.
 */
export const BAR: Record<Stance, Action[]> = {
  serve: ["charge", "spin"],
  toss: ["serve"],
  ground: ["bump", "set", "dive"],
  air: ["spike", "jumpset", "block"],
  idle: [],
};

/** The control for an action in a stance (the bar's keycap). */
export function controlOf(stance: Stance, action: Action): Control | null {
  const row = ACTIONS[stance];
  for (const c of Object.keys(row) as Control[]) if (row[c] === action) return c;
  return null;
}

export function stanceOf(m: Match, i: number): Stance {
  const p = m.players[i], sv = serverOf(m) === i;
  if (m.phase === "serve") return sv ? "serve" : "idle";
  if (m.phase === "toss") return sv ? "toss" : "idle";
  if (m.phase !== "rally") return "idle";
  return p.s.mode === "air" ? "air" : "ground";
}

/** What a press of `c` does for player `i` now. */
export const actionFor = (m: Match, i: number, c: Control): Action | null => ACTIONS[stanceOf(m, i)][c] ?? null;
