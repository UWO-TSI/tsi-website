"use client";

/**
 * Study HUD for the island (specs/study-world.md §4). Owns the one
 * useStudySession() and shares it with the 3D seats through worldStore.
 * Sit prompt, start sheet (the companion's Setup), a compact timer card with
 * the host's private-table toggle, table chat (the companion's Chat), the
 * cafe wall board. Dev only: `?study=tables|setup|focus|break|ended` runs the
 * companion's in-memory demo so signed-out screenshots show real state.
 */
import { useEffect, useRef, useState } from "react";
import { useSearch } from "@/lib/game/useMediaQuery";
import { Amount } from "@/components/economy/Amount";
import { Empty, ErrorNote, Loading, Toggle, useSignInHref } from "@/components/gui";
import { BookOpen } from "lucide-react";
import { worldKeysBlocked } from "@/lib/game/useWorldDialog";
import IslandSheet from "../IslandSheet";
import { studyDemo } from "@/lib/study/demo";
import { settlementToast } from "@/lib/study/settlement";
import { AudioManager } from "@/lib/game/audio";
import { toast } from "../ToastHub";
import { iconUrl } from "@/lib/icons/keys";
import { httpStudyTransport, type Board, type StudyTransport } from "@/lib/study/transport";
import { formatClock, useStudySession, type StudyHook } from "@/lib/study/useStudySession";
import { seatAvatar, setWorldStudy, useWorldStudy } from "@/lib/study/worldStore";
import { Chat, Setup } from "@/components/study/StudyCompanion";
import card from "@/components/study/companion.module.css";
import world from "../DefaultIslandWorld.module.css";
import s from "./study.module.css";

export default function StudyHud() {
  const search = useSearch();
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
  // The 3D seats read the hook through worldStore: republished only when what they draw changes (your countdown
  // ticks it once a second while you study; the table list only on a server answer). Cleared when the HUD goes.
  const published = useRef<StudyHook | null>(null);
  useEffect(() => {
    const p = published.current;
    if (p && p.tables === study.tables && p.session === study.session && p.table === study.table && p.remaining === study.remaining
      && p.signedOut === study.signedOut && p.busy === study.busy) return;
    published.current = study;
    setWorldStudy({ study });
  });
  useEffect(() => () => setWorldStudy({ study: null, near: null, seated: null }), []);
  const near = useWorldStudy(w => w.near);
  const [boardOpen, setBoardOpen] = useState(false);
  const { session, refresh } = study;
  // Signed out: the prompt links to sign-in and back here (reachability §3).
  const signIn = useSignInHref();

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
      if (e.repeat || e.key.toLowerCase() !== "e" || !near || boardOpen || worldKeysBlocked()) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, button")) return;
      act();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // A study error (a full table, a dropped connection) is said in the toast lane, as the island's other notes are.
  const error = study.error, here = !!(near || session);
  useEffect(() => { if (error && here) toast(error); }, [error, here]);

  // Settlement (cafe-polish §5): a coin toast and the confirm chime (the café bell when it lands, row 125).
  const ended = study.lastEnded;
  useEffect(() => {
    const told = ended && settlementToast(ended);
    if (!told) return;
    toast(told.text, told.coins > 0 ? iconUrl("coin") : undefined);
    if (told.coins > 0) AudioManager.playSFX("confirm");
  }, [ended]);

  return <>
    {near && !boardOpen && (study.signedOut && near !== "board"
      ? <a className={world.interact} href={signIn}>Sign in to study here</a>
      : <button className={world.interact} onClick={act} disabled={study.busy}><kbd>E</kbd>{near === "board" ? "Read the study board" : session ? "Sit back down" : `Sit · ${table?.label ?? "Table"}`}</button>)}
    {session?.phase === "seated" && <div className={s.startSheet} role="dialog" aria-label="Start studying"><Setup study={study} /></div>}
    {session && session.phase !== "seated" && <div className={s.panel}>
      <Timer study={study} />
      {!study.chatMuted && <Chat study={study} />}
    </div>}
    <BoardSheet open={boardOpen} study={study} transport={transport ?? httpStudyTransport} onClose={() => setBoardOpen(false)} />
  </>;
}

/** Compact timer card: the companion's controls without the phone-sized ring. */
function Timer({ study }: { study: StudyHook }) {
  const x = study.session!;
  const isHost = study.mates.some(m => m.me && m.is_host);
  return <section className={`${card.card} ${s.timer}`} aria-label="Study timer">
    <p className={s.phase} data-phase={x.phase}>{x.phase === "focus" ? "Focus" : "Break"}<span>{x.phase === "break" && " · stretch"} · cycle {x.cycle} of {x.settings?.cycles}</span></p>
    <p className={s.clock} role="timer">{formatClock(study.remaining)}</p>
    <p className={card.muted}>{study.table?.label} · {x.minutes_completed} min banked · <Amount n={x.coins_pending} /> so far</p>
    <div className={`${card.row} ${s.actions}`}>
      {x.phase === "focus"
        ? <button className={card.ghost} onClick={study.takeBreak} disabled={study.busy}>Break now</button>
        : <button className={card.ghost} onClick={study.resume} disabled={study.busy}>Skip break</button>}
      <button className={card.btn} onClick={study.end} disabled={study.busy}>Stand up</button>
    </div>
    <p className={card.muted} style={{ marginTop: 8 }}>Walking away from your seat ends the session and pays your focus minutes.</p>
    <Toggle checked={!study.chatMuted} disabled={x.phase === "break"} onChange={on => study.setChatOpen(on)}>Table chat {study.chatMuted ? "muted while you focus" : "on"}</Toggle>
    {isHost && <Toggle checked={!!study.table?.is_private} onChange={on => study.lock(on)} hint="Only people already here">Private table</Toggle>}
  </section>;
}

/** The cafe wall board: this week's opt-in top studiers (row 171). Opened with E at the board; E closes it too. */
function BoardSheet({ open, study, transport, onClose }: { open: boolean; study: StudyHook; transport: StudyTransport; onClose: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const optedIn = study.stats?.on_board;
  useEffect(() => { if (open) transport.board().then(b => { setBoard(b); setFailed(false); }, () => setFailed(true)); }, [open, transport, optedIn]);
  return <IslandSheet open={open} title="Top studiers this week" onClose={onClose} testId="study-board" keys="e">
    {failed ? <ErrorNote>The board didn’t load. The connection may have dropped.</ErrorNote>
      : !board ? <Loading label="Reading the board…" />
      : board.top.length === 0 ? <Empty icon={<BookOpen size={32} />} title="Nobody on the board yet">Opt in and study to be the first this week.</Empty>
      : <ol className={s.board}>{board.top.map(r => <li key={r.rank}><span>{r.rank}. {r.name}</span><b>{r.minutes} min</b></li>)}</ol>}
    {study.stats && <Toggle checked={study.stats.on_board} onChange={on => study.setBoardOptIn(on)} hint={`${study.stats.minutes} min so far this week`}>Show me on this board</Toggle>}
    <p className={card.muted}>Only members who opt in appear. Resets every Monday.</p>
  </IslandSheet>;
}
