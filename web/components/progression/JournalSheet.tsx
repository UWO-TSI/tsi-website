"use client";

import { useState } from "react";
import { advance, setHudMuted } from "@/lib/progression/client";
import { ApiError } from "@/lib/apiClient";
import type { AdvanceAction } from "@/lib/progression/chapters";
import { refreshProgression, setProgressionState, useProgression } from "@/lib/progression/useProgression";
import type { ChapterView, GoalProgressView, ProgressionState } from "@/lib/progression/types";
import { museumLine } from "@/lib/game/mainQuest";
import { GAME_WORLD } from "@/lib/game/world/active";
import { onBoard } from "@/lib/progression/seasonal";
import ClubGoal, { UpNextGoal, isUpNext } from "./ClubGoal";
import ContributeSheet from "./ContributeSheet";
import { LettersBody } from "./LettersSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import { Button, Empty, Progress, SignInText, TabPanel, Tabs, Toggle } from "@/components/gui";
import { Fold, Folds, QuietButton, Section } from "@/components/gui/cream";
import { BookOpen, Check, Flag, Lock } from "lucide-react";
import m from "./menus.module.css";

type Tab = "quests" | "goals" | "letters";

const STATUS_LABEL: Record<ChapterView["status"], string> = { locked: "Locked", active: "In progress", ready: "Ready", completed: "Done", skipped: "Skipped" };

function chapterActions(c: ChapterView): { action: AdvanceAction; label: string }[] {
  if (c.status !== "active" && c.status !== "ready") return [];
  const out: { action: AdvanceAction; label: string }[] = [];
  const open = (k: string) => c.steps.find((x) => x.key === k && !x.done);
  if (c.requirement === "settle_in") {
    // The village's chapter 1, as it always played.
    if (open("claim_plot")) out.push({ action: "claim_plot", label: "Claim plot" });
    if (open("donate_catch") && !open("first_catch")) out.push({ action: "donate_catch", label: "Donate catch" });
    if (c.status === "ready") out.push({ action: "report_hq", label: "Report to HQ" });
  } else if (c.requirement === "first_find") {
    // The new world's chapter 1 and its errands finish by talking to their person (Juno, Odile, Pim, Bram, Eliza).
    if (open("claim_plot")) out.push({ action: "claim_plot", label: "Claim plot" });
  } else if (c.status === "ready" && (c.requirement === "club_goal" || c.requirement === "oracle_trial")) {
    out.push({ action: "complete", label: c.requirement === "club_goal" ? "Finish chapter" : "Open the gate" });
  }
  if (c.can_skip) out.push({ action: "skip", label: "Skip chapter" });
  return out;
}

export function JournalBody({ initialTab = "quests" }: { initialTab?: Tab }) {
  const { state } = useProgression();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [contributeSlug, setContributeSlug] = useState<string | null>(null);
  // The chapter that's open: the one under way until you pick another (null: all closed).
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const preview = state.source === "defaults";
  const current = state.chapters.find((c) => c.status === "active" || c.status === "ready") ?? null;
  const openSlug = picked === undefined ? current?.slug ?? null : picked;

  const act = async (slug: string, action: AdvanceAction) => {
    setBusy(`${slug}:${action}`);
    setMessage(null);
    try {
      setProgressionState(await advance(slug, action));
      setMessage({ kind: "ok", text: action === "skip" ? "Chapter skipped." : "Journal updated." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Couldn't reach HQ. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const toggleMute = async () => {
    try {
      await setHudMuted(!state.hud_muted);
      await refreshProgression();
    } catch {
      setMessage({ kind: "err", text: "Couldn't save that setting." });
    }
  };

  const board = state.goals.filter(onBoard);
  const open = board.filter((g) => !isUpNext(g)), next = board.filter(isUpNext);
  return (
    <div className={m.menu}>
      <Tabs label="Journal sections" value={tab} onChange={setTab} className={m.tabs}
        tabs={[{ id: "quests", label: "Quests" }, { id: "goals", label: "Club goals" }, { id: "letters", label: "Letters", badge: state.unread_letters }]} />
      {preview ? <p className={m.note}><SignInText text="Preview: sign in to save quest progress." /></p> : null}
      {message ? <p role="status" className={m.note} data-tone={message.kind}>{message.text}</p> : null}

      <TabPanel id={tab}>
        {tab === "quests" ? <>
          <Folds label="Chapters">
            {state.chapters.map((c, i) => {
              const locked = c.status === "locked", done = c.status === "completed" || c.status === "skipped";
              // The village numbers by position as always; the new world's errands sit after the club rows', so it counts.
              const n = GAME_WORLD === "new" ? i + 1 : c.position;
              return <Fold key={c.slug} testId="chapter" label={`Chapter ${n}: ${c.title}, ${STATUS_LABEL[c.status]}`}
                state={done ? "done" : locked ? "locked" : "now"}
                lead={done ? <Check size={18} strokeWidth={3} /> : locked ? <Lock size={15} /> : n}
                title={c.title} line={`Chapter ${n}`}
                meta={locked ? null : <span className={m.status} data-s={c.status}>{STATUS_LABEL[c.status]}</span>}
                open={openSlug === c.slug} onToggle={locked ? undefined : () => setPicked(openSlug === c.slug ? null : c.slug)}>
                <ChapterPage c={c} museum={state.museum} goal={c.goal_slug ? state.goals.find((g) => g.slug === c.goal_slug) ?? null : null}
                  now={state.objective?.chapter_slug === c.slug ? state.objective.step_key : null}
                  busy={busy} preview={preview} onAct={(a) => void act(c.slug, a)} onContribute={setContributeSlug} />
              </Fold>;
            })}
          </Folds>
          <div className={m.foot}>
            <Toggle checked={!state.hud_muted} onChange={() => void toggleMute()} disabled={preview}>Show the current objective under the minimap</Toggle>
          </div>
        </> : null}

        {tab === "goals" ? <>
          {board.length === 0 ? <Empty icon={<Flag size={32} />} title="No club goals right now">The next one goes up on the notice board.</Empty> : null}
          <div className={m.goals}>{open.map((g) => <ClubGoal key={g.slug} goal={g} onContribute={setContributeSlug} />)}</div>
          {next.length ? <Section title="Up next" className={m.after}>
            {next.map((g) => <UpNextGoal key={g.slug} goal={g} waitingOnTitle={state.goals.find((x) => x.slug === g.locked_by)?.title} />)}
          </Section> : null}
          <p className={`${m.aside} ${m.after}`}>Real club activity counts most: QR check-ins at events and completed bounties are credited automatically.</p>
        </> : null}

        {tab === "letters" ? <LettersBody /> : null}
      </TabPanel>

      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </div>
  );
}

/** An open chapter: what it's about, its steps (the one to do now highlighted), and its one action. */
function ChapterPage({ c, museum, goal, now, busy, preview, onAct, onContribute }: {
  c: ChapterView; museum: ProgressionState["museum"]; goal: GoalProgressView | null; now: string | null; busy: string | null; preview: boolean;
  onAct: (a: AdvanceAction) => void; onContribute: (slug: string) => void;
}) {
  const actions = chapterActions(c), skip = actions.find((a) => a.action === "skip"), moves = actions.filter((a) => a.action !== "skip");
  const contribute = c.requirement === "club_goal" && c.status === "active" && c.goal_slug ? c.goal_slug : null;
  const label = (a: { action: AdvanceAction; label: string }) => (busy === `${c.slug}:${a.action}` ? "One moment…" : a.label);
  return <>
    <p className={m.text}>{c.summary}</p>
    {c.requirement === "museum_collab" ? <p className={m.text}>{museumLine(museum)}</p> : null}
    <ul className={m.steps}>
      {c.steps.map((step) => <li key={step.key} className={m.step} data-done={step.done} data-now={now === step.key || undefined}>
        <span className={m.check} aria-hidden="true">{step.done ? <Check size={13} strokeWidth={3.5} /> : null}</span>
        <span className={m.stepText}>
          <span className={m.stepLabel}>{step.label}{step.count && !step.done ? ` ${step.count.have}/${step.count.need}` : null}{now === step.key ? <span className={m.srOnly}> (do this next)</span> : null}</span>
          {step.hint && !step.done ? <span className={m.hint}>{step.hint}</span> : null}
        </span>
      </li>)}
    </ul>
    {goal && (c.status === "active" || c.status === "ready") ? <Progress value={goal.percent} max={100} kind="xp" showLabel label="Club progress" className={m.chapterBar}
      valueText={`${goal.percent}% · your share ${goal.my_points.toLocaleString()} pts`} /> : null}
    {contribute || moves.length || skip ? <div className={m.actions}>
      {contribute ? <Button onClick={() => onContribute(contribute)}>Contribute</Button> : null}
      {moves.map((a, i) => <Button key={a.action} variant={i === 0 && !contribute ? "primary" : "secondary"} disabled={busy !== null || preview} onClick={() => onAct(a.action)}>{label(a)}</Button>)}
      {skip ? <QuietButton className={m.end} disabled={busy !== null || preview} onClick={() => onAct("skip")}>{label(skip)}</QuietButton> : null}
    </div> : null}
  </>;
}

/** `keys`: J (fixed), which closes the journal too. */
export default function JournalSheet({ open, onClose, initialTab, keys }: ProgressionSheetProps & { initialTab?: Tab; keys?: string }) {
  return (
    <ProgressionPanel flat open={open} onClose={onClose} title="Journal" wide keys={keys} icon={<BookOpen size={20} />}>
      <JournalBody initialTab={initialTab} />
    </ProgressionPanel>
  );
}
