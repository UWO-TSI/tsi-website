"use client";

/**
 * Quest complete (David's v2 review: "it shows quest complete check mark animation"): a paper disc pops in high in the
 * middle, a check draws itself across it, a ring bursts and a few sparks fly, the quest's name under it; then it fades.
 * `tsi:quest-complete` { title } shows it. Bram's walk-along ends with it, before his rod's card (DefaultIslandWorld).
 */
import { useEffect, useState } from "react";
import { AudioManager } from "@/lib/game/audio";
import s from "./QuestComplete.module.css";

/** How long it stays up (ms): the card that follows waits this long. */
export const QUEST_COMPLETE_MS = 2100;

export default function QuestComplete() {
  const [shown, setShown] = useState<{ title: string; id: number } | null>(null);
  useEffect(() => {
    let t = 0, id = 0;
    const on = (e: Event) => {
      const title = (e as CustomEvent<{ title?: string }>).detail?.title;
      if (typeof title !== "string" || !title) return;
      setShown({ title, id: ++id });
      AudioManager.playSFX("confirm", { rate: 1.05, gain: 0.7 });
      window.setTimeout(() => AudioManager.playSFX("blip4", { rate: 1.6, gain: 0.4 }), 380);
      window.clearTimeout(t);
      t = window.setTimeout(() => setShown(null), QUEST_COMPLETE_MS);
    };
    window.addEventListener("tsi:quest-complete", on);
    return () => { window.removeEventListener("tsi:quest-complete", on); window.clearTimeout(t); };
  }, []);
  if (!shown) return null;
  return <div key={shown.id} className={`${s.layer} gui`} role="status" aria-live="polite" data-testid="quest-complete" style={{ "--qc-ms": `${QUEST_COMPLETE_MS}ms` } as React.CSSProperties}>
    <div className={s.badge} aria-hidden="true">
      <span className={s.ring} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <i key={i} className={s.spark} style={{ "--a": `${i * 45 + 22}deg` } as React.CSSProperties} />)}
      <svg className={s.check} viewBox="0 0 64 64"><path d="M17 33.5 L28 44 L48 21" /></svg>
    </div>
    <p className={s.eyebrow}>Quest complete</p>
    <p className={s.title}>{shown.title}</p>
  </div>;
}
