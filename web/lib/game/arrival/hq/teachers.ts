/**
 * Tools unlocked by people (row 312, specs/hq-onboarding.md; David: "you unlock like bug net and stuff from npc convo
 * and mini sub tutorial quest"). After Bram's tour you have his rod only. Each other tool has a resident who teaches
 * it: talk to them and they hand it over with a tiny quest that teaches it (catch any bug, dig up one buried thing),
 * shown in the quest tracker; when it's done the tool is yours.
 *
 * The table is data: who teaches what (a resident's slug, lib/content/residentRoster.ts), the tier-1 tool their talk
 * hands over (lib/game/tools.ts) and what finishes the quest (the kind a `tsi:peaceful-got` catch reports). The pairing
 * is David's (approved 2026-10-17, specs/hq-onboarding.md "Who teaches which tool"); the later rows aren't built yet.
 *
 * Only for a member whose tools are taught (they arrived under row 312); everyone else keeps the starters and their
 * residents talk as they always did. Pure: the island keeps the quests' states (store.ts) and feeds them in.
 */
import type { TrackedQuest } from "@/lib/game/questTracker";
import { TOOL_LINES } from "./lines";

/** The tools a resident hands over today (lib/game/tools.ts TAUGHT_KINDS). */
export type TaughtTool = "net" | "shovel";
/** A catch's kind as the world reports it (tsi:peaceful-got `kind`). */
export type CatchKind = "bug" | "dig" | "forage" | "fish";

export interface ToolTeacher {
  tool: string;
  /** Who teaches it: their roster slug (null: not cast yet). */
  npc: string | null;
  /** Built and live: their talk hands it over. False: a placeholder row for a later tool. */
  live: boolean;
  /** The tool their talk hands over (an inventory key, lib/game/tools.ts); null for a move. */
  key: string | null;
  /** The catch that finishes the little quest. */
  finish: CatchKind | null;
}

export const TOOL_TEACHERS: readonly ToolTeacher[] = [
  // Odile, the museum curator: wings, Latin names, the cases waiting to be filled.
  { tool: "net", npc: "curator", live: true, key: "net-basic", finish: "bug" },
  // Pim, the tinkerer: combs the beach, finds what's buried, "perfectly good".
  { tool: "shovel", npc: "crafter", live: true, key: "shovel-basic", finish: "dig" },
  // Later tools (proposals in the spec; nothing here is built). The dash is everyone's from the start; the glider comes
  // with the mountain expansion (lib/game/moveUnlocks.ts `unlockMove` is its hook).
  { tool: "axe", npc: "mayor", live: false, key: null, finish: null },
  { tool: "glider", npc: "nell", live: false, key: null, finish: null },
];

const LIVE = TOOL_TEACHERS.filter((t): t is ToolTeacher & { tool: TaughtTool; npc: string; key: string; finish: CatchKind } => t.live && !!t.npc && !!t.key && !!t.finish);
export const teacherOf = (tool: string) => LIVE.find(t => t.tool === tool) ?? null;
export const isTaughtTool = (tool: unknown): tool is TaughtTool => LIVE.some(t => t.tool === tool);

/** Each tool's little quest on this device: handed over and running, or done. */
export type ToolQuests = Partial<Record<TaughtTool, "given" | "done">>;

export interface TeachContext {
  /** This member's tools are taught (they arrived under row 312). */
  taught: boolean;
  /** Owned gear keys (the inventory, and what's been handed over here). */
  owned: readonly string[];
  quests: ToolQuests;
}

/** A conversation a teacher has with you instead of their usual one: its script id and its lines. */
export interface TeacherTalk { script: string; tool: TaughtTool; lines: readonly string[] }

/**
 * What a resident says when you talk to them, if it's a teacher's talk: the offer (you've not got their tool yet), or a
 * nudge while its quest runs. Null: their usual conversation (not a teacher, your tools aren't taught, or it's done).
 */
export function teacherTalk(slug: string, c: TeachContext): TeacherTalk | null {
  if (!c.taught) return null;
  for (const t of LIVE) {
    if (t.npc !== slug) continue;
    const q = c.quests[t.tool];
    if (q === "given") return { script: `tool:${t.tool}:during`, tool: t.tool, lines: TOOL_LINES[t.tool].during };
    if (q === "done" || c.owned.includes(t.key)) continue;
    return { script: `tool:${t.tool}:offer`, tool: t.tool, lines: TOOL_LINES[t.tool].offer };
  }
  return null;
}

/** A teacher's talk is over: the offer's end hands the tool over (null: nothing to hand over). */
export function handOver(script: string, quests: ToolQuests): TaughtTool | null {
  const m = /^tool:(\w+):offer$/.exec(script);
  const tool = m?.[1];
  return isTaughtTool(tool) && !quests[tool] ? tool : null;
}

/** A catch came in: the running quest it finishes (null: none). */
export function questFinished(kind: CatchKind, quests: ToolQuests): TaughtTool | null {
  return LIVE.find(t => t.finish === kind && quests[t.tool] === "given")?.tool ?? null;
}

/** The tools handed over on this device (their inventory keys): on the wheel at once, before the inventory reads back. */
export const givenKeys = (quests: ToolQuests) => LIVE.filter(t => quests[t.tool]).map(t => t.key);

/** The first running quest as the tracker shows it (null: none running). */
export function toolQuest(quests: ToolQuests): TrackedQuest | null {
  const t = LIVE.find(x => quests[x.tool] === "given");
  if (!t) return null;
  const l = TOOL_LINES[t.tool];
  return { id: `tool:${t.tool}`, title: l.title, kind: "quest", steps: [{ id: `tool:${t.tool}:${t.finish}`, label: l.step, done: false }] };
}

/** Saved quests read back: only known tools and states. */
export function parseQuests(raw: unknown): ToolQuests {
  if (!raw || typeof raw !== "object") return {};
  const out: ToolQuests = {};
  for (const [k, v] of Object.entries(raw)) if (isTaughtTool(k) && (v === "given" || v === "done")) out[k] = v;
  return out;
}
