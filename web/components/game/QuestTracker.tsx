"use client";

/**
 * The quest tracker and its dropdown (playtest round 1, decisions 3 and 5; t-next, David 2026-10-27: "make it a quest
 * drop down top right beside mini map where you can read the quests, clicking on the quest brings out arrow"). Closed,
 * it is one compact line, the name of the task being worked on ("◆ Catch 3 bugs 1/3"). Clicking it drops the list of
 * your quests down: each one's steps (done ticked, the current one with its hint); clicking a quest that leads somewhere
 * points the guide arrow there (clicking it again puts the arrow away). Generic: it shows whatever TrackedQuests it's
 * handed (lib/game/questTracker.ts): the walk-along's, the HQ visit's, the main quest's chapter (lib/game/mainQuest.ts).
 * It places itself top right; a host moves it with `className` or the `--quest-top` / `--quest-right` custom properties.
 *
 * A step that's just been done shows ticked for a moment before the line moves on to the next one. Matte paper from the
 * GUI kit.
 */
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Navigation } from "lucide-react";
import { currentStep, questProgress, type TrackedQuest } from "@/lib/game/questTracker";
import s from "./QuestTracker.module.css";

const TICK_MS = 1100;
/** The dropdown calls the chapter the main quest. */
const KIND_NAME = { tutorial: "Tutorial", quest: "Quest", chapter: "Main quest" } as const;


export interface QuestTrackerProps {
  /** Your quests, the one being worked on first (its step is the line); empty shows nothing. */
  quests: readonly TrackedQuest[];
  /** Hide it for a while (a cinematic, a sheet over the HUD): it fades out and back. */
  hidden?: boolean;
  /** The quests that lead somewhere (by id): clicking one points the guide arrow (`onGuide`). */
  guidable?: readonly string[];
  /** The quest the arrow points for now, if any. */
  guided?: string | null;
  onGuide?: (id: string | null) => void;
  /** Opens the Esc menu's Quests and journal (from the list). */
  onOpen?: () => void;
  className?: string;
}

export default function QuestTracker({ quests, hidden = false, guidable = [], guided = null, onGuide, onOpen, className }: QuestTrackerProps) {
  const quest = quests[0] ?? null;
  const [picked, setOpen] = useState(false);
  // The HUD going away (a cinematic, a sheet) takes the list with it.
  const open = picked && !hidden;
  const root = useRef<HTMLElement>(null);
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
  // The list closes on Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", away, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", away, true); };
  }, [open]);
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
  return <aside ref={root} className={`${s.tracker} ${className ?? ""}`} data-hidden={hidden || undefined} data-done={isDone || undefined} data-ticked={justDone ? "" : undefined}
    data-open={open || undefined} data-kind={quest.kind} aria-label={`${KIND_NAME[quest.kind]}: ${quest.title}`} data-testid="quest-tracker">
    <button type="button" className={s.line} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="quest-list" title={`${quest.title} · ${done}/${of}`}>
      {face}<ChevronDown className={s.chevron} size={15} strokeWidth={3} aria-hidden="true" /><span className={s.sr}>. Show your quests</span>
    </button>
    {open && <div id="quest-list" className={s.list} role="region" aria-label="Your quests">
      {quests.map(q => {
        const now = currentStep(q).step, leads = guidable.includes(q.id), on = guided === q.id;
        return <section key={q.id} className={s.quest} data-guided={on || undefined}>
          <div className={s.head}>
            <span className={s.kind}>{KIND_NAME[q.kind]}</span>
            <span className={s.title}>{q.title}</span>
            {/* The guide arrow (David: "just an arrow icon you can press on"): pressed, it points the way; again, it's put away. */}
            {leads && <button type="button" className={s.way} aria-pressed={on} aria-label={on ? `Hide the arrow to ${q.title}` : `Show the way to ${q.title}`}
              title={on ? "Hide the arrow" : "Show the way"} onClick={() => onGuide?.(on ? null : q.id)}><Navigation size={16} strokeWidth={2.75} aria-hidden="true" /></button>}
          </div>
          <ul className={s.steps}>
            {q.steps.map(x => <li key={x.id} className={s.step} data-done={x.done || undefined} data-now={x.id === now?.id || undefined}>
              <span className={s.check} aria-hidden="true">{x.done ? <Check size={11} strokeWidth={3.5} /> : null}</span>
              <span>{x.label}{x.id === now?.id && q.hint ? <small className={s.hint}>{q.hint}</small> : null}</span>
            </li>)}
          </ul>
        </section>;
      })}
      {onOpen && <button type="button" className={s.journal} onClick={() => { setOpen(false); onOpen(); }}><BookOpen size={14} aria-hidden="true" />Open the journal</button>}
    </div>}
    <p className={s.sr} role="status" aria-live="polite">{complete ? `${quest.title}: all done` : step ? `Next: ${step.label}` : ""}</p>
  </aside>;
}
