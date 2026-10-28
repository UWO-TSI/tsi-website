"use client";

/**
 * ─── World ⇄ progression data (island agent) ─────────────────────────────
 *
 * The island renders progression (plaza monument, ceremony, mailbox, notice
 * board, minimap objective, chapter-1 prompts) from `WorldProgression`
 * (`@/lib/progression/worldBridge`), with anchors resolved to village XZ here.
 *
 * Dev overrides (not in production): `?goal=` is applied by the systems
 * agent's store (lib/progression/devOverride.ts); `?ceremony=1` here forces
 * the completion ceremony for the latest goal.
 */
import { useCallback, useEffect, useState } from "react";
import { useProgressionWorldSource, type WorldGoalId, type WorldProgression } from "@/lib/progression/worldBridge";
import { useProgression, setProgressionState } from "@/lib/progression/useProgression";
import { advance } from "@/lib/progression/client";
import type { ObjectiveAnchor } from "@/lib/progression/types";
import { landmark, landmarkPoint, type LandmarkId } from "./defaultIsland";
import { digSpots, villageNodes } from "./islandNodes";
import { installIslandProgressionDemo } from "./progressionDemo";

installIslandProgressionDemo();

export type { WorldGoalId };
/** A club goal on the monument; progress is 0..1 of its target. */
type WorldGoal = NonNullable<WorldProgression["activeGoal"]>;

const SEEN_KEY = "tsi.ceremony.seen.v1";
export function readSeenCeremonies(storage?: Pick<Storage, "getItem"> | null): WorldGoalId[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is WorldGoalId => id === "cafe" || id === "museum") : [];
  } catch { return []; }
}
export function markCeremonySeen(id: WorldGoalId, storage?: Pick<Storage, "getItem" | "setItem"> | null): void {
  try { storage?.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeenCeremonies(storage), id])])); } catch { /* Best effort. */ }
}
/** A goal's ceremony plays once: when it is complete and not yet seen (or forced). */
export function ceremonyDue(goal: Pick<WorldGoal, "id" | "completed"> | null, seen: readonly WorldGoalId[], force = false): boolean {
  return !!goal && goal.completed && (force || !seen.includes(goal.id));
}

/** The nearest of some spots to `from` (the first without one). */
const nearest = (spots: readonly { x: number; z: number }[], from?: [number, number] | null): [number, number] | null => {
  let best: [number, number] | null = null, d = Infinity;
  for (const s of spots) {
    const e = from ? Math.hypot(s.x - from[0], s.z - from[1]) : 0;
    if (e < d) { d = e; best = [s.x, s.z]; }
    if (!from) break;
  }
  return best;
};

/**
 * Objective anchors → village XZ (door fronts, the wharf for fishing), from the village map. The quest's kinds of spot
 * (bugs, dig spots, rocks) resolve to the one nearest `from` (the player).
 */
export function resolveAnchor(anchor: ObjectiveAnchor, from?: [number, number] | null): [number, number] | null {
  const front = (id: LandmarkId): [number, number] | null => { const l = landmark(id); return l && [l.x, l.z - (l.half?.[1] ?? 0) - 0.6]; };
  const at = (id: LandmarkId, dx = 0): [number, number] | null => { const l = landmark(id); return l && [l.x + dx, l.z]; };
  switch (anchor) {
    case "hq": return landmarkPoint("hq", "door");
    case "monument": return front("monument");
    case "fishing_spot": case "wharf": return at("wharf");
    case "beach": return at("beach");
    case "plaza": return at("plaza");
    case "museum": return front("museum");
    case "oracle": return front("oracle");
    case "ruins_gate": return at("ruins", -0.8);
    case "bugs": return nearest(villageNodes().bugs, from);
    case "rocks": return nearest(villageNodes().forage.filter(n => n.id.startsWith("rock-")), from);
    case "dig_spots": return nearest(digSpots(), from);
    default: return null;
  }
}

export interface WorldProgressionView extends Pick<WorldProgression, "activeGoal" | "completedGoals" | "unreadLetters" | "hudMuted" | "source"> {
  /** One line under the minimap, and the world XZ of its marker (both empty when the HUD is muted). */
  objective: { text: string; target: [number, number] | null };
  /** Goal whose ceremony is due (latest completion, or forced). */
  ceremonyGoal: WorldGoal | null;
  forceCeremony: boolean;
}

export function useProgressionWorld(): WorldProgressionView {
  const live = useProgressionWorldSource(resolveAnchor);
  const [force] = useState(() => process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ceremony") === "1");
  const forcedGoal = force ? (live.recentlyCompleted ?? (live.activeGoal ? { ...live.activeGoal, progress: 1, completed: true } : null)) : null;
  return {
    activeGoal: live.activeGoal, completedGoals: forcedGoal ? [...new Set([...live.completedGoals, forcedGoal.id])] : live.completedGoals,
    objective: { text: live.hudMuted ? "" : live.objective.text, target: live.hudMuted ? null : live.objective.target },
    unreadLetters: live.unreadLetters, hudMuted: live.hudMuted, source: live.source,
    ceremonyGoal: forcedGoal ?? live.recentlyCompleted, forceCeremony: force,
  };
}

/**
 * Chapter 1 (Settle in) world actions (row 101): which prompts to show and how to run them. A step the drop hides
 * (claiming your plot before the home island's: lib/game/drops.ts) isn't in the chapter, so it is never offered and
 * never waited on. The village donates at the museum's door and reports at HQ's; the new world's chapter 1 (first-find)
 * ends with Juno's talk (lib/game/mainQuest.ts), so it offers neither. `fresh`: chapter 1 is open with neither the plot
 * claimed nor a catch donated (a new member: the first-login greeting).
 */
export interface ChapterActions { claim: boolean; donate: boolean; report: boolean; fresh: boolean; run: (action: "claim_plot" | "donate_catch" | "report_hq") => Promise<string | null> }
export function chapterOneActions(chapters: readonly { slug: string; status: string; steps: readonly { key: string; done: boolean }[] }[]) {
  const settle = chapters.find(c => c.slug === "settle-in" || c.slug === "first-find");
  const village = settle?.slug === "settle-in";
  const open = settle && (settle.status === "active" || settle.status === "ready");
  const has = (key: string) => !!settle?.steps.some(s => s.key === key);
  const done = (key: string) => !!settle?.steps.find(s => s.key === key)?.done;
  return {
    claim: !!open && has("claim_plot") && !done("claim_plot"),
    donate: village && !!open && (!has("claim_plot") || done("claim_plot")) && !done("donate_catch"),
    report: village && settle.status === "ready",
    fresh: !!open && settle.status === "active" && !done("claim_plot") && !done("donate_catch"),
  };
}
export function useChapterActions(): ChapterActions {
  const { state } = useProgression();
  const run = useCallback(async (action: "claim_plot" | "donate_catch" | "report_hq") => {
    const slug = state.chapters.find(c => c.slug === "settle-in" || c.slug === "first-find")?.slug ?? "settle-in";
    try { setProgressionState(await advance(slug, action)); return null; }
    catch (error) { return error instanceof Error ? error.message : "That didn't go through. Try again."; }
  }, [state.chapters]);
  return { ...chapterOneActions(state.chapters), run };
}

/** Ceremony trigger: returns true for ~6 s once per completed goal. */
export function useCeremony(goal: WorldGoal | null, force: boolean): boolean {
  const [active, setActive] = useState(false);
  const id = goal?.id, completed = goal?.completed ?? false;
  useEffect(() => {
    if (!id || !completed) return;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Private mode: plays each visit. */ }
    if (!ceremonyDue({ id, completed }, readSeenCeremonies(storage), force)) return;
    const start = window.setTimeout(() => setActive(true), 1200);
    const stop = window.setTimeout(() => { setActive(false); markCeremonySeen(id, storage); }, 7200);
    return () => { window.clearTimeout(start); window.clearTimeout(stop); };
  }, [id, completed, force]);
  return active;
}
