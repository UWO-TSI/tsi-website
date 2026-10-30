/**
 * What a level up opens (David 2026-10-28, on the new world's chapter 1: "get enough exp to level up to level 2, should
 * have overlay of what unlocks"). Only what really exists: the quest that just opened (your next main-quest chapter),
 * and the stat points the level earns, while the Path sheet that spends them is out (lib/game/drops.ts `classes`).
 * Nothing else in the game is gated by your level yet. Pure.
 */
import { POINTS_PER_LEVEL } from "@/lib/combat/progression";
import { personalChapter } from "@/lib/progression/chapters";
import type { ChapterView } from "@/lib/progression/types";

export interface LevelUnlock { kind: "quest" | "points"; title: string; detail: string }

export function levelUnlocks(chapters: readonly ChapterView[], classesOut: boolean): LevelUnlock[] {
  const out: LevelUnlock[] = [];
  const next = personalChapter(chapters);
  if (next) out.push({ kind: "quest", title: `New quest: ${next.title}`, detail: next.summary });
  if (classesOut) out.push({ kind: "points", title: `${POINTS_PER_LEVEL} stat points`, detail: "Spend them on your path (P)." });
  return out;
}
