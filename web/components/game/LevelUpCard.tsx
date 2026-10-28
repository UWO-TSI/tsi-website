"use client";

/**
 * The level-up card (David 2026-10-28: "chapter 1 done get enough exp to level up to level 2, should have overlay of
 * what unlocks"): when a chapter's XP takes you up a level (the advance's `xp_gain`), a paper card over the island says
 * the new level and what it opens (lib/game/levelUp.ts: only what's real). A click, E, Enter or Escape puts it away.
 */
import { useEffect, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { API_WRITE } from "@/lib/apiClient";
import { AudioManager } from "@/lib/game/audio";
import { DROPS } from "@/lib/game/drops";
import { levelUnlocks, type LevelUnlock } from "@/lib/game/levelUp";
import type { ProgressionState } from "@/lib/progression/types";
import { BigMoment } from "@/components/gui/flat";

/** The quest-complete check plays first; the level up follows it. */
const AFTER_CHECK_MS = 1600;

export default function LevelUpCard() {
  const [shown, setShown] = useState<{ level: number; unlocks: LevelUnlock[] } | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const { path, data } = (e as CustomEvent<{ path?: string; data?: ProgressionState }>).detail ?? {};
      const g = path === "/api/progression/chapters/advance" ? data?.xp_gain : undefined;
      if (!g?.levelled_up || !data) return;
      // After the chapter's own check-mark moment (tutorial-v2's QuestCheck, on "tsi:quest-complete"), not over it.
      const next = { level: g.level, unlocks: levelUnlocks(data.chapters, DROPS.classes) };
      window.setTimeout(() => { setShown(next); AudioManager.playSFX("confirm"); }, AFTER_CHECK_MS);
    };
    window.addEventListener(API_WRITE, on);
    return () => window.removeEventListener(API_WRITE, on);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key.toLowerCase() !== "e") return;
      e.stopPropagation(); e.preventDefault(); setShown(null);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [shown]);
  if (!shown) return null;
  return <BigMoment kicker="Level up" big={shown.level} title={`You're level ${shown.level}`} testId="level-up" onClose={() => setShown(null)}
    items={shown.unlocks.map(u => ({ key: u.kind, icon: u.kind === "quest" ? <BookOpen size={18} /> : <Sparkles size={18} />, title: u.title, line: u.detail }))} />;
}
