"use client";

/**
 * Study HUD for the island (specs/study-world.md §4). Owns the one
 * useStudySession() and shares it with the 3D seats through worldStore.
 * Sit prompt, start sheet (the companion's Setup), a compact timer card with
 * the host's private-table toggle, table chat (the companion's Chat), the
 * cafe wall board. Dev only: `?study=tables|setup|focus|break|ended` runs the
 * companion's in-memory demo so signed-out screenshots show real state.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { COINS } from "@/lib/economy";
import { studyDemo } from "@/lib/study/demo";
import { httpStudyTransport, type Board, type StudyTransport } from "@/lib/study/transport";
import { formatClock, useStudySession, type StudyHook } from "@/lib/study/useStudySession";
import { seatAvatar, setWorldStudy, useWorldStudy } from "@/lib/study/worldStore";
import { Chat, Setup } from "@/components/study/StudyCompanion";
import card from "@/components/study/companion.module.css";
import world from "../DefaultIslandWorld.module.css";
import s from "./study.module.css";

const noSub = () => () => {};

export default function StudyHud() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  const demo = process.env.NODE_ENV !== "production" && search ? new URLSearchParams(search).get("study") : null;
  if (search === null) return null;
  return demo ? <Demo scenario={demo} /> : <Hud />;
}

function Demo({ scenario }: { scenario: string }) {
  const [transport, setTransport] = useState<StudyTransport | null>(null);
  useEffect(() => { void studyDemo(scenario).then(setTransport); }, [scenario]);
  return transport ? <Hud transport={transport} /> : null;
}

function Hud({ transport }: { transport?: StudyTransport }) {
  const study = useStudySession({ transport, title: "Tethos Island" });
  // The 3D seats read the live hook every render; clear it when the HUD goes.
  useEffect(() => { setWorldStudy({ study }); });
  useEffect(() => () => setWorldStudy({ study: null, near: null, seated: null }), []);
  const near = useWorldStudy(w => w.near);
  const [boardOpen, setBoardOpen] = useState(false);
  const { session, refresh } = study;

  // Presence: while not seated, refresh who is studying every 30 s (seated sessions heartbeat).
  const active = !!session;
  useEffect(() => {
    if (active) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [active, refresh]);

  const table = near && near !== "board" ? study.tables.find(t => t.anchor === near.anchor) : null;
  const act = () => {
    if (near === "board") setBoardOpen(true);
    else if (near && session) seatAvatar(near); // back to your own seat
    else if (near && table && !study.signedOut) void study.sit(table.id, near.seat);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== "e" || !near || boardOpen) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, button")) return;
      act();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const ended = study.lastEnded;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!ended) return;
    const t = window.setTimeout(() => setDismissed(ended.id), 6000);
    return () => window.clearTimeout(t);
  }, [ended]);

  return <>
    {near && !boardOpen && (study.signedOut && near !== "board"
      ? <a className={world.interact} href="/student/login">Sign in to study here</a>
      : <button className={world.interact} onClick={act} disabled={study.busy}><kbd>E</kbd>{near === "board" ? "Read the study board" : session ? "Sit back down" : `Sit · ${table?.label ?? "Table"}`}</button>)}
    {session?.phase === "seated" && <div className={s.startSheet} role="dialog" aria-label="Start studying"><Setup study={study} /></div>}
    {session && session.phase !== "seated" && <div className={s.panel}>
      <Timer study={study} />
      {!study.chatMuted && <Chat study={study} />}
    </div>}
    {!session && ended && dismissed !== ended.id && <p className={world.actionNote} role="status">
      {ended.end_reason === "finished" ? "Session complete" : ended.end_reason === "timeout" ? "Session ended after 5 minutes away" : "You left your seat"}
      {` · +${ended.coins_paid ?? ended.coins_pending} ${COINS.symbol} · ${ended.minutes_completed} focus min`}
    </p>}
    {study.error && (near || session) && <p className={world.actionNote} role="alert">{study.error}</p>}
    {boardOpen && <BoardSheet study={study} transport={transport ?? httpStudyTransport} onClose={() => setBoardOpen(false)} />}
  </>;
}

/** Compact timer card: the companion's controls without the phone-sized ring. */
function Timer({ study }: { study: StudyHook }) {
  const x = study.session!;
  const isHost = study.mates.some(m => m.me && m.is_host);
  return <section className={card.card} aria-label="Study timer">
    <p className={s.phase} data-phase={x.phase}>{x.phase === "focus" ? "Focus" : "Break · stretch"} · cycle {x.cycle} of {x.settings?.cycles}</p>
    <p className={s.clock} role="timer">{formatClock(study.remaining)}</p>
    <p className={card.muted}>{study.table?.label} · {x.minutes_completed} min banked · {x.coins_pending} {COINS.symbol} so far</p>
    <div className={card.row} style={{ marginTop: 10 }}>
      {x.phase === "focus"
        ? <button className={card.ghost} onClick={study.takeBreak} disabled={study.busy}>Break now</button>
        : <button className={card.ghost} onClick={study.resume} disabled={study.busy}>Skip break</button>}
      <button className={card.btn} onClick={study.end} disabled={study.busy}>Stand up</button>
    </div>
    <p className={card.muted} style={{ marginTop: 8, fontSize: 11 }}>Walking away from your seat ends the session and pays your focus minutes.</p>
    <label className={card.toggle}>
      <input type="checkbox" checked={!study.chatMuted} disabled={x.phase === "break"} onChange={e => study.setChatOpen(e.target.checked)} />
      Table chat {study.chatMuted ? "muted while you focus" : "on"}
    </label>
    {isHost && <label className={card.toggle}>
      <input type="checkbox" checked={!!study.table?.is_private} onChange={e => study.lock(e.target.checked)} />
      Private table (only people already here)
    </label>}
  </section>;
}

/** The cafe wall board: this week's opt-in top studiers (row 171). */
function BoardSheet({ study, transport, onClose }: { study: StudyHook; transport: StudyTransport; onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const optedIn = study.stats?.on_board;
  useEffect(() => { transport.board().then(setBoard, () => setFailed(true)); }, [transport, optedIn]);
  return <section className={world.sheet} role="dialog" aria-modal="false" aria-labelledby="study-board-title">
    <header><h2 id="study-board-title">Top studiers this week</h2><button onClick={onClose} aria-label="Close">×</button></header>
    {failed ? <p>The board couldn&apos;t load. Try again in a moment.</p>
      : !board ? <p>Reading the board…</p>
      : board.top.length === 0 ? <p>Nobody on the board yet this week. Opt in and study to be the first.</p>
      : <ol className={s.board}>{board.top.map(r => <li key={r.rank}><span>{r.rank}. {r.name}</span><b>{r.minutes} min</b></li>)}</ol>}
    {study.stats && <label className={card.toggle}>
      <input type="checkbox" checked={study.stats.on_board} onChange={e => study.setBoardOptIn(e.target.checked)} />
      Show me on this board ({study.stats.minutes} min so far this week)
    </label>}
    <small>Only members who opt in appear. Resets every Monday.</small>
  </section>;
}
