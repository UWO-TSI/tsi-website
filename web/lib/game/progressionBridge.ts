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
import { landmark } from "./defaultIsland";
import { installIslandProgressionDemo } from "./progressionDemo";

installIslandProgressionDemo();

export type { WorldGoalId };
/** A club goal on the monument; progress is 0..1 of its target. */
type WorldGoal = NonNullable<WorldProgression["activeGoal"]>;

/** Monument build stage 0–4 for the 0/25/50/75/100% milestones (row 182). */
export function monumentStage(progress: number): 0 | 1 | 2 | 3 | 4 {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return p >= 1 ? 4 : p >= 0.75 ? 3 : p >= 0.5 ? 2 : p >= 0.25 ? 1 : 0;
}

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
export function ceremonyDue(goal: WorldGoal | null, seen: readonly WorldGoalId[], force = false): boolean {
  return !!goal && goal.completed && (force || !seen.includes(goal.id));
}

/** Objective anchors → village XZ (door fronts, the pier for fishing). */
export function resolveAnchor(anchor: ObjectiveAnchor): [number, number] | null {
  const front = (id: Parameters<typeof landmark>[0]) => { const l = landmark(id); return [l.x, l.z - (l.half?.[1] ?? 0) - 0.6] as [number, number]; };
  switch (anchor) {
    case "hq": return [0, 6.3];
    case "monument": return front("monument");
    case "fishing_spot": return [8, -19.5];
    case "museum": return front("museum");
    case "oracle": return front("oracle");
    case "ruins_gate": return [landmark("ruins").x - 0.8, landmark("ruins").z];
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

/** Chapter 1 (Settle in) world actions: which prompts to show and how to run them (row 101). */
export interface ChapterActions { claim: boolean; donate: boolean; report: boolean; run: (action: "claim_plot" | "donate_catch" | "report_hq") => Promise<string | null> }
export function chapterOneActions(chapters: readonly { slug: string; status: string; steps: readonly { key: string; done: boolean }[] }[]) {
  const settle = chapters.find(c => c.slug === "settle-in");
  const open = settle && (settle.status === "active" || settle.status === "ready");
  const done = (key: string) => !!settle?.steps.find(s => s.key === key)?.done;
  return {
    claim: !!open && !done("claim_plot"),
    donate: !!open && done("claim_plot") && !done("donate_catch"),
    report: !!settle && settle.status === "ready",
  };
}
export function useChapterActions(): ChapterActions {
  const { state } = useProgression();
  const run = useCallback(async (action: "claim_plot" | "donate_catch" | "report_hq") => {
    try { setProgressionState(await advance("settle-in", action)); return null; }
    catch (error) { return error instanceof Error ? error.message : "That didn't go through. Try again."; }
  }, []);
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
    if (!ceremonyDue({ id, label: "", progress: 1, completed }, readSeenCeremonies(storage), force)) return;
    const start = window.setTimeout(() => setActive(true), 1200);
    const stop = window.setTimeout(() => { setActive(false); markCeremonySeen(id, storage); }, 7200);
    return () => { window.clearTimeout(start); window.clearTimeout(stop); };
  }, [id, completed, force]);
  return active;
}
