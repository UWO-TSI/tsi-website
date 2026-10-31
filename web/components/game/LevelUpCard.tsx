"use client";

/**
 * The level-up card (David 2026-10-28: "chapter 1 done get enough exp to level up to level 2, should have overlay of
 * what unlocks"; "everything should be when exp is filled"): when the HUD's XP bar fills (HudBars' LEVEL_FILLED), the
 * kit's big moment says the new level and what it opens (lib/game/levelUp.ts: only what's real). A finished chapter's
 * check-mark (tutorial-v2's QuestCheck, on "tsi:quest-complete") plays first; the card waits for it. A click, E, Enter
 * or Escape puts it away.
 */
import { useEffect, useRef, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";
import { DROPS } from "@/lib/game/drops";
import { levelUnlocks } from "@/lib/game/levelUp";
import { useProgression } from "@/lib/progression/useProgression";
import { BigMoment } from "@/components/gui/flat";
import { LEVEL_FILLED } from "./HudBars";

/** The quest-complete check's length: the card shows no sooner after it. */
const AFTER_CHECK_MS = 1600;

export default function LevelUpCard() {
  const { state } = useProgression();
  const [shown, setShown] = useState<{ level: number; chapter: boolean } | null>(null);
  const checkAt = useRef(-Infinity);
  useEffect(() => {
    let t = 0;
    const checked = () => { checkAt.current = performance.now(); };
    const filled = (e: Event) => {
      const next = (e as CustomEvent<{ level: number }>).detail.level;
      window.clearTimeout(t);
      // A chapter's level up (its check just played) opens its next quest; any other (a kill, a mission) only the level.
      const chapter = performance.now() - checkAt.current < 5000;
      t = window.setTimeout(() => { setShown({ level: next, chapter }); AudioManager.playSFX("confirm"); }, Math.max(0, checkAt.current + AFTER_CHECK_MS - performance.now()));
    };
    window.addEventListener("tsi:quest-complete", checked);
    window.addEventListener(LEVEL_FILLED, filled);
    return () => { window.clearTimeout(t); window.removeEventListener("tsi:quest-complete", checked); window.removeEventListener(LEVEL_FILLED, filled); };
  }, []);
  if (!shown) return null;
  const unlocks = levelUnlocks(state.chapters, DROPS.classes).filter(u => shown.chapter || u.kind !== "quest");
  return <BigMoment kicker="Level up" big={shown.level} title={`You're level ${shown.level}`} testId="level-up" onClose={() => setShown(null)}
    items={unlocks.map(u => ({ key: u.kind, icon: u.kind === "quest" ? <BookOpen size={18} /> : <Sparkles size={18} />, title: u.title, line: u.detail }))} />;
}
