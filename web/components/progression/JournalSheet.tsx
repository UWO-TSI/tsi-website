"use client";

import { useState } from "react";
import { advance, setHudMuted } from "@/lib/progression/client";
import { ApiError } from "@/lib/apiClient";
import type { AdvanceAction } from "@/lib/progression/chapters";
import { refreshProgression, setProgressionState, useProgression } from "@/lib/progression/useProgression";
import type { ChapterView } from "@/lib/progression/types";
import { onBoard } from "@/lib/progression/seasonal";
import ContributeSheet from "./ContributeSheet";
import GoalCard from "./GoalCard";
import { LettersBody } from "./LettersSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import { Empty, Tabs, Toggle } from "@/components/gui";
import { Flag } from "lucide-react";
import s from "./progression.module.css";

type Tab = "quests" | "goals" | "letters";

const STATUS_LABEL: Record<ChapterView["status"], string> = { locked: "Locked", active: "In progress", ready: "Ready", completed: "Done", skipped: "Skipped" };

function chapterActions(c: ChapterView): { action: AdvanceAction; label: string }[] {
  if (c.status !== "active" && c.status !== "ready") return [];
  const out: { action: AdvanceAction; label: string }[] = [];
  const open = (k: string) => c.steps.find((x) => x.key === k && !x.done);
  if (c.requirement === "settle_in") {
    if (open("claim_plot")) out.push({ action: "claim_plot", label: "Claim plot" });
    if (open("donate_catch") && !open("first_catch")) out.push({ action: "donate_catch", label: "Donate catch" });
    if (c.status === "ready") out.push({ action: "report_hq", label: "Report to HQ" });
  } else if (c.status === "ready") {
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
  const preview = state.source === "defaults";

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

  return (
    <div>
      <Tabs label="Journal sections" value={tab} onChange={setTab} className={s.tabs}
        tabs={[{ id: "quests", label: "Quests" }, { id: "goals", label: "Club goals" }, { id: "letters", label: "Letters", badge: state.unread_letters }]} />
      {preview ? <p className={`${s.note} ${s.info}`}>Preview: sign in to save quest progress.</p> : null}
      {message ? <p role="status" className={`${s.note} ${message.kind === "ok" ? s.ok : s.err}`}>{message.text}</p> : null}

      {tab === "quests" ? (
        <div>
          {state.objective ? (
            <p className={s.muted} style={{ marginBottom: 10 }}>Now: <span className={s.current}>{state.objective.text}</span></p>
          ) : null}
          {state.chapters.map((c) => (
            <article key={c.slug} className={`${s.card} ${c.status === "locked" ? s.locked : ""}`} aria-label={`Chapter ${c.position}: ${c.title}`}>
              <div className={s.row}>
                <div>
                  <div className={s.eyebrow}>Chapter {c.position}</div>
                  <h3>{c.title}</h3>
                </div>
                <span className={s.status} data-s={c.status}>{STATUS_LABEL[c.status]}</span>
              </div>
              <p className={s.muted}>{c.status === "locked" ? "Finish the chapter before this one to begin." : c.summary}</p>
              {c.status !== "locked" ? (
                <ul className={s.steps}>
                  {c.steps.map((step) => (
                    <li key={step.key} className={s.step} data-done={step.done}>
                      <span className={s.check} aria-hidden>{step.done ? "✓" : ""}</span>
                      <span>
                        {step.label}
                        {step.hint && !step.done ? <span className={s.hint}>{step.hint}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.requirement === "club_goal" && c.goal_slug && (c.status === "active" || c.status === "ready") ? (
                (() => {
                  const g = state.goals.find((x) => x.slug === c.goal_slug);
                  return g ? <p className={s.muted}>Club progress {g.percent}% · your share {g.my_points.toLocaleString()} pts</p> : null;
                })()
              ) : null}
              <div className={s.actions}>
                {c.requirement === "club_goal" && c.status === "active" && c.goal_slug ? (
                  <button className={s.btn} onClick={() => setContributeSlug(c.goal_slug)}>Contribute</button>
                ) : null}
                {chapterActions(c).map((a) => (
                  <button key={a.action} className={a.action === "skip" ? s.ghost : s.btn} disabled={busy !== null || preview} onClick={() => act(c.slug, a.action)}>
                    {busy === `${c.slug}:${a.action}` ? "…" : a.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
          <Toggle checked={!state.hud_muted} onChange={() => void toggleMute()} disabled={preview}>Show the current objective under the minimap</Toggle>
        </div>
      ) : null}

      {tab === "goals" ? (
        <div>
          {state.goals.length === 0 ? <Empty icon={<Flag size={32} />} title="No club goals right now">The next one goes up on the notice board.</Empty> : null}
          {state.goals.filter(onBoard).map((g) => <GoalCard key={g.slug} goal={g} waitingOnTitle={state.goals.find((x) => x.slug === g.locked_by)?.title} onContribute={setContributeSlug} />)}
          <p className={s.muted}>Real club activity counts most: QR check-ins at events and completed bounties are credited automatically.</p>
        </div>
      ) : null}

      {tab === "letters" ? <LettersBody /> : null}

      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </div>
  );
}

/** `keys`: J (fixed), which closes the journal too. */
export default function JournalSheet({ open, onClose, initialTab, keys }: ProgressionSheetProps & { initialTab?: Tab; keys?: string }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Journal" wide keys={keys}>
      <JournalBody initialTab={initialTab} />
    </ProgressionPanel>
  );
}
