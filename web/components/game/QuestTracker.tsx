"use client";

/**
 * The quest tracker (playtest round 1, decisions 3 and 5): a small to-do list top right of the HUD, ticking off as you
 * go. Generic: it shows whatever TrackedQuest it's handed (lib/game/questTracker.ts): the walk-along's steps today
 * (useTutorialQuest), quests and chapters later. It places itself top right under the HUD's top cluster; a host moves
 * it with `className` or the `--quest-top` / `--quest-right` custom properties.
 *
 * A window of rows round the step being worked on (done ones ticked, the current one marked, what's next dimmed), the
 * folded rest counted. A step that's just been done pops its tick. Matte paper from the GUI kit.
 */
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Footprints, ScrollText } from "lucide-react";
import { questProgress, trackerRows, type QuestKind, type TrackedQuest } from "@/lib/game/questTracker";
import s from "./QuestTracker.module.css";

const ICON: Record<QuestKind, typeof Footprints> = { tutorial: Footprints, quest: ScrollText, chapter: BookOpen };
const TICK_MS = 1100;

export interface QuestTrackerProps {
  /** What to show; null shows nothing. */
  quest: TrackedQuest | null;
  /** Hide it for a while (a cinematic, a sheet over the HUD): it fades out and back. */
  hidden?: boolean;
  /** How many rows to list round the current step (default 5; a phone gets fewer from its own CSS). */
  size?: number;
  /** Opens the quest's page (the Esc menu's Quests and journal, when it exists): the title becomes a button. */
  onOpen?: () => void;
  className?: string;
}

export default function QuestTracker({ quest, hidden = false, size = 5, onOpen, className }: QuestTrackerProps) {
  // Steps that have just been ticked (they pop): the done ids seen last render, per quest.
  const seen = useRef<{ quest: string; done: Set<string> } | null>(null);
  const [ticked, setTicked] = useState<{ ids: string[]; at: number } | null>(null);
  useEffect(() => {
    if (!quest) { seen.current = null; return; }
    const done = new Set(quest.steps.filter(x => x.done).map(x => x.id));
    const before = seen.current?.quest === quest.id ? seen.current.done : null;
    seen.current = { quest: quest.id, done };
    const fresh = before ? [...done].filter(id => !before.has(id)) : [];
    if (!fresh.length) return;
    const at = performance.now();
    // Deferred: a tick is a reaction to the steps changing, not part of the render that changed them.
    const show = window.setTimeout(() => setTicked({ ids: fresh, at }), 0);
    const clear = window.setTimeout(() => setTicked(t => (t?.at === at ? null : t)), TICK_MS);
    return () => { window.clearTimeout(show); window.clearTimeout(clear); };
  }, [quest]);
  if (!quest || !quest.steps.length) return null;
  const { rows, above, below, complete } = trackerRows(quest, size);
  const { done, of } = questProgress(quest);
  const Icon = ICON[quest.kind];
  const current = rows.find(r => r.current);
  const head = <><Icon size={15} aria-hidden /><span className={s.title}>{quest.title}</span><span className={s.count} aria-label={`${done} of ${of} done`}>{done}/{of}</span></>;
  return <aside className={`${s.tracker} ${className ?? ""}`} data-hidden={hidden || undefined} data-complete={complete || undefined} data-kind={quest.kind}
    aria-label={`${quest.kind === "tutorial" ? "Tutorial" : quest.kind === "chapter" ? "Chapter" : "Quest"}: ${quest.title}`} data-testid="quest-tracker">
    {onOpen ? <button type="button" className={s.head} onClick={onOpen}>{head}</button> : <div className={s.head}>{head}</div>}
    {above > 0 && <p className={s.fold} aria-hidden="true">{above} done</p>}
    <ol className={s.list}>
      {rows.map((r, i) => {
        const after = current ? i - rows.indexOf(current) : 0;
        return <li key={r.id} className={s.row} data-done={r.done || undefined} data-current={r.current || undefined} data-later={after > 1 || undefined}
          data-ticked={ticked?.ids.includes(r.id) || undefined} aria-current={r.current ? "step" : undefined}>
          <span className={s.mark} aria-hidden="true">{r.done ? <Check size={11} strokeWidth={3.5} /> : null}</span>
          <span className={s.label}>{r.label}{r.done && <span className={s.sr}> (done)</span>}</span>
          {r.current && quest.hint && <span className={s.hint}>{quest.hint}</span>}
        </li>;
      })}
    </ol>
    {below > 0 && <p className={s.fold} aria-hidden="true">+{below} more</p>}
    <p className={s.sr} role="status" aria-live="polite">{complete ? `${quest.title}: all done` : current ? `Next: ${current.label}` : ""}</p>
  </aside>;
}
