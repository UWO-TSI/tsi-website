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
import s from "./LevelUpCard.module.css";

export default function LevelUpCard() {
  const [shown, setShown] = useState<{ level: number; unlocks: LevelUnlock[] } | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const { path, data } = (e as CustomEvent<{ path?: string; data?: ProgressionState }>).detail ?? {};
      const g = path === "/api/progression/chapters/advance" ? data?.xp_gain : undefined;
      if (!g?.levelled_up || !data) return;
      setShown({ level: g.level, unlocks: levelUnlocks(data.chapters, DROPS.classes) });
      AudioManager.playSFX("confirm");
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
  return <div className={s.scrim} onClick={() => setShown(null)} data-testid="level-up">
    <section className={s.card} role="dialog" aria-modal="true" aria-labelledby="level-up-title">
      <p className={s.eyebrow}><Sparkles size={14} aria-hidden="true" />Level up</p>
      <h2 id="level-up-title" className={s.level}>Level {shown.level}</h2>
      {shown.unlocks.length > 0 && <>
        <p className={s.what}>What's new</p>
        <ul className={s.list}>{shown.unlocks.map(u => <li key={u.kind} className={s.item}>
          <span className={s.icon} aria-hidden="true">{u.kind === "quest" ? <BookOpen size={16} /> : <Sparkles size={16} />}</span>
          <span><b>{u.title}</b><small>{u.detail}</small></span>
        </li>)}</ul>
      </>}
      <button type="button" className={s.ok} onClick={() => setShown(null)} autoFocus>Nice!</button>
    </section>
  </div>;
}
