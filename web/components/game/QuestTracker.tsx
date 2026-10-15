"use client";

/**
 * The quest tracker (playtest round 1, decisions 3 and 5; David 2026-10-14: "make the quest on the left side of the
 * mini map, also shrink the todo quest down to only the name"): one compact line, the name of the task being worked on
 * ("◆ Make your first catch"), no hint and no list. Generic: it shows whatever TrackedQuest it's handed
 * (lib/game/questTracker.ts): the walk-along's steps (useTutorialQuest), the chapter, quests later. It places itself top
 * right; a host moves it with `className` or the `--quest-top` / `--quest-right` custom properties.
 *
 * A step that's just been done shows ticked for a moment before the line moves on to the next one. Matte paper from the
 * GUI kit.
 */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { currentStep, questProgress, type TrackedQuest } from "@/lib/game/questTracker";
import s from "./QuestTracker.module.css";

const TICK_MS = 1100;
const KIND_NAME = { tutorial: "Tutorial", quest: "Quest", chapter: "Chapter" } as const;

export interface QuestTrackerProps {
  /** What to show; null shows nothing. */
  quest: TrackedQuest | null;
  /** Hide it for a while (a cinematic, a sheet over the HUD): it fades out and back. */
  hidden?: boolean;
  /** Opens the quest's page (the Esc menu's Quests and journal): the line becomes a button. */
  onOpen?: () => void;
  className?: string;
}

export default function QuestTracker({ quest, hidden = false, onOpen, className }: QuestTrackerProps) {
  // Steps that have just been ticked (the line shows the last one done for a moment): the done ids seen last render, per quest.
  const seen = useRef<{ quest: string; done: Set<string> } | null>(null);
  const [ticked, setTicked] = useState<{ quest: string; id: string; at: number } | null>(null);
  useEffect(() => {
    if (!quest) { seen.current = null; return; }
    const done = new Set(quest.steps.filter(x => x.done).map(x => x.id));
    const before = seen.current?.quest === quest.id ? seen.current.done : null;
    seen.current = { quest: quest.id, done };
    const fresh = before ? [...done].filter(id => !before.has(id)) : [];
    if (!fresh.length) return;
    const at = performance.now(), id = fresh[fresh.length - 1];
    // Deferred: a tick is a reaction to the steps changing, not part of the render that changed them.
    const show = window.setTimeout(() => setTicked({ quest: quest.id, id, at }), 0);
    const clear = window.setTimeout(() => setTicked(t => (t?.at === at ? null : t)), TICK_MS);
    return () => { window.clearTimeout(show); window.clearTimeout(clear); };
  }, [quest]);
  if (!quest || !quest.steps.length) return null;
  const { step, complete } = currentStep(quest);
  const { done, of } = questProgress(quest);
  const justDone = ticked?.quest === quest.id ? quest.steps.find(x => x.id === ticked.id && x.done) : undefined;
  const shown = justDone ?? step;
  const label = shown?.label ?? quest.title;
  const isDone = !!justDone || complete;
  const face = <>
    <span className={s.mark} aria-hidden="true">{isDone ? <Check size={12} strokeWidth={3.5} /> : "◆"}</span>
    <span key={shown?.id ?? "complete"} className={s.label}>{label}</span>
    <span className={s.sr}>{complete ? ", all done" : justDone ? ", done" : ""} ({quest.title}, {done} of {of} done)</span>
  </>;
  return <aside className={`${s.tracker} ${className ?? ""}`} data-hidden={hidden || undefined} data-done={isDone || undefined} data-ticked={justDone ? "" : undefined}
    data-kind={quest.kind} aria-label={`${KIND_NAME[quest.kind]}: ${quest.title}`} data-testid="quest-tracker">
    {onOpen
      ? <button type="button" className={s.line} onClick={onOpen} title={`${quest.title} · ${done}/${of}. Open Quests and journal`}>{face}</button>
      : <div className={s.line} title={`${quest.title} · ${done}/${of}`}>{face}</div>}
    <p className={s.sr} role="status" aria-live="polite">{complete ? `${quest.title}: all done` : step ? `Next: ${step.label}` : ""}</p>
  </aside>;
}
