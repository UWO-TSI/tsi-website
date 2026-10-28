"use client";

/**
 * Quest complete (David's v2 review: "it shows quest complete check mark animation"): the kit's QuestCheck high in the
 * middle, its chime, then gone. `tsi:quest-complete` { title } shows it. Bram's walk-along ends with it, before his
 * rod's card ("From Bram", RewardCard) as the rod flies into your bag (DefaultIslandWorld).
 */
import { useEffect, useState } from "react";
import { QUEST_CHECK_MS, QuestCheck } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";

export { QUEST_CHECK_MS as QUEST_COMPLETE_MS };

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
      t = window.setTimeout(() => setShown(null), QUEST_CHECK_MS);
    };
    window.addEventListener("tsi:quest-complete", on);
    return () => { window.removeEventListener("tsi:quest-complete", on); window.clearTimeout(t); };
  }, []);
  return shown ? <QuestCheck key={shown.id} eyebrow="Quest complete" title={shown.title} testId="quest-complete" /> : null;
}
